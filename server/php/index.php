<?php
require_once("config.php");
require_once("autoload/vendor/autoload.php");
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
error_reporting(E_ALL);
ini_set('display_errors', 1);

/*
$config = [
	"ZIP_FILE"=>"deployment.zip",
	"TMP_ZIP_FOLDER"=>"./tmp/",
	"SECRET"=>'ABC',
	"DEPLOY_AT"=>"./deploy/"
];
*/
	
function getFileExtension($file)
{
	$re = '/\.([A-z0-9]{1,})$/m';
	preg_match($re, $file, $matches);

	// Print the entire match result
	// var_dump($matches);
	if(empty($matches)) return null;
	return $matches[1];
}

function rrmdir($dir)
{
	if (is_dir($dir))
	{
		$objects = scandir($dir);
		foreach ($objects as $object)
		{
			if ($object != '.' && $object != '..')
			{
				if (filetype($dir.'/'.$object) == 'dir') {rrmdir($dir.'/'.$object);}
				else {unlink($dir.'/'.$object);}
			}
		}
		reset($objects);
		rmdir($dir);
	}
}

class Responder
{
	static function json_response($code, $data)
	{
		http_response_code($code);
		header('Content-Type: application/json; charset=utf-8');
		echo json_encode($data);
		exit;
	}
	static public function require_keys($decoded, $keys)
	{
		
		foreach($keys as $key)
		{
			if(!isset($decoded->$key)) throw new Exception("Token Is Missing $key");
		}
	}
}

class JWTTool
{
	static public function verify($secret_key, $jwt)
	{
		$decoded = JWT::decode($jwt, new Key($secret_key, 'HS256'));
		Responder::require_keys($decoded, ["iat", "exp"]);
		return $decoded;
	}
}
class ZipDeploy
{
	static function unzip(
		$file_path, // zip file
		$path // folder
		)
	{
		$zip = new ZipArchive;
		// $res = $zip->open('src.zip');
		if(!file_exists($file_path)) throw new Exception("$file_path file not found");
		$res = $zip->open($file_path);
		if ($res !== TRUE) {
			return ;
		}
		
		$file_count = $zip->numFiles;
		$zip_file_path = substr($file_path, 2);
		// $info = [];
		for($i = 0; $i < $file_count; $i++) {
			$filename = $zip->getNameIndex($i);
			// $ext = getFileExtension($filename);
			$stat = $zip->statName($filename);
			// $info[] = $stat;
			if($stat['size'] > 0)
			{
				$fileinfo = pathinfo($filename);
				$files[] = $filename;
			} else 
			{
				$file = $path."/".$filename;
				if(file_exists($file))
				{
					if(!is_dir($file))
					{
						unlink($file);
					}
				}
			}
		}   
		$zip->extractTo($path, $files);
		
		$zip->close();
		
	}
}

set_error_handler(function($errno, $errstr, $errfile, $errline){
	if($errno === E_WARNING){
		//echo "WARNING";
		// make it more serious than a warning so it can be caught
		
		Responder::json_response(400, [
			"time"=>time() + 30,
			"msg"=>$errstr
		]);
		return false;
	} else {
		// fallback to default php error handler
		return false;
	}
});

function get_header($name)
{
	$name = strtolower($name);
	$headers = getallheaders();
	
	foreach($headers as $key => $value)
	{
		$key = strtolower($key);
		if($key == $name)
		{
			// echo "$key equals $name ($value) ";
			return $value;
		} else {
			// echo "$key <> $name ";
		}
	}
	// echo "return null";
	return null;
}
try{
	$dir = $config["TMP_ZIP_FOLDER"];
	$authorization = get_header("Authorization");
	if(!$authorization) {
		throw new Exception("Missing token");
	}
	$jwt = str_replace("Bearer ", "", $authorization);
	JWTTool::verify($config["SECRET"], $jwt);
	
	
	$jsonString = file_get_contents('php://input');
	$json = json_decode($jsonString, false);
	
	if(!isset($_REQUEST["action"]))
	{
		Responder::json_response(400, [
			"msg"=>"missing action"
		]);
	}
	$action = $_REQUEST["action"];
	if($action == "verify")
	{
		Responder::json_response(
			200, 
			["message"=>"OK"]
		);
	} else if($action == "deploy_status")
	{
		$target_path = $config["DEPLOY_AT"];
		$file = $target_path."deployment.json";
		if(!file_exists($file))
		{
			Responder::json_response(
				200, 
				null
			);
		}
		$content = file_get_contents($file);
		Responder::json_response(
			200, 
			json_decode($content)
		);
	} else if($action == "deploy")
	{
		rrmdir("temp");
		rrmdir("pending_del");
		
		// ZipDeploy::unzip("dist.zip", "./temp/");
		$target_path = $config["DEPLOY_AT"] ;
		ZipDeploy::unzip(
			$dir. $config["ZIP_FILE"], 
			$target_path
		);
		
		// if(file_exists($target_path)) rename($target_path, "pending_del");
		// rename("temp", $target_path);
		
		Responder::json_response(200, [
			"time"=>time() + 30,
			"msg"=>"OK"
		]);
	} else if($action == "upload")
	{
		if( !isset( $_FILES["file"] ) ){
			Responder::json_response(400, [
				"msg"=>"no file to upload"
			]);
		}
		/* change path to suit environment */
        // $dir='c:/temp/fileuploads/1/';
		$obj=(object)$_FILES['file'];
        $name = $config["ZIP_FILE"];
		$tmp=$obj->tmp_name;
		$extension = getFileExtension($obj->name);
		if($extension == "zip")
		{
			if (!file_exists($dir)) {
				mkdir($dir, 0777, true);
			}

			$result = move_uploaded_file( $tmp, $dir.$name );
			Responder::json_response(200, [
				"msg"=>"OK"
			]);
		} else {
			Responder::json_response(400, [
				"msg"=>".$extension is not allowed"
			]);
		}
		
		
		Responder::json_response(400, [
			"msg"=>"not implement yet", 
			"files"=>$_FILES
		]);
	} else {
		Responder::json_response(400, [
			"msg"=>"unknown action"
		]);
	}
	
} catch(Exception $error)
{
	Responder::json_response(400, [
		"time"=>time() + 30,
		"msg"=>$error->getMessage()  
	]);
}