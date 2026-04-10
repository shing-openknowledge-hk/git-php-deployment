#!/usr/bin/env node

const { exit, stdout, stderr, emitWarning } = require('node:process');
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

var dotenv = require('dotenv');
const yargs = require("yargs");
var DeployTool = require("./DeployTool");
var GitInfo = require("./GitInfo.js");
const options = yargs
	 // .usage("Usage: -n <A>")
	 .option("e", { alias: "env", describe: "env file", type: "string"})
	 .usage("Usage: --env <.env>")
	 .option("c", { alias: "config", describe: "config json file", type: "string"})
	 .usage("Usage: --config config.json")
	 .option("a", { alias: "action", describe: "action verify/deploy", type: "string"})
	 .usage("Usage: -a <action> / --action <action>")
	 .argv;
// "node_modules/.bin/git-php-deploy" --config config.json --action verify
// "node_modules/.bin/git-php-deploy" --config config.json --action deploy

var env = options.e ? dotenv.config({path:options.e}).parsed : dotenv.config().parsed;



var tool = new DeployTool();
function copy(from, to)
{
	for(var key in from)
	{
		to[key] = from[key];
	}
}

function getConfig()
{
	if(options.config)
	{
		var configString = fs.readFileSync(options.config);
		var config = JSON.parse(configString +"");	
	} else {
		var config = {GIT:{path:"./"}};	
	}
	var output = {};
	copy(process.env, output);
	copy(env, output);
	copy(config, output);
	return output;
}
function run(fn)
{
	fn().then((data)=>{
		console.log(data);
	}).catch((reason)=>{
		
		if( reason instanceof Error)
		{
			console.error("--------------" + reason.message +"----------------");
			console.error("error", reason.stack);
			console.error("--------------------------------------");
		} else {
			console.error("error", reason);
		}
		exit(1);
	});
}

/*
if(!config.SECRET && env.SECRET)
{
	config.SECRET = env.SECRET;
}
*/

if(options.action == "verify")
{
	run(async ()=>{
		var config = getConfig();
		return await tool.verifyConfig(config);
		// return await tool.verify(config.URL, config.SECRET);
	});
} else if(options.action == "init")
{
	run(async ()=>{
		var config = getConfig();
		var gitInfo = new GitInfo(config.GIT.path);
		if(config.TYPE == "FTP")
		{
			// var jsonPath = "/git_status.json";
			// options = await tool.getFTPDeploymentInfo(config.ACCOUNT, jsonPath);
			var latestCommit = await gitInfo.getLastestCommit();
			if(latestCommit)
			{
				delete latestCommit.files;
				delete latestCommit.status;
				console.info("latestCommit", latestCommit)
				console.info("writing summary(git_status.json) to server ");
				await tool.save_summarize(config.ACCOUNT, {latest:latestCommit}, "/git_status.json");
			} else {
				console.error("no commit is found");
			}
		};
		return "init COMPLETED";
	});
} else if(options.action == "test")
{
	run(async ()=>{
		var config = getConfig();
		var gitInfo = new GitInfo(config.GIT.path);
		var info = await gitInfo.getCommitInfo(
			{
				after:"2026-03-10 11:35:31 +0800"
			}, 
			config.SYNC,
		);
		// fileSyntaxCheck("./", ["files/a.js", "files/b.ts", "files/c.json"]);
		fileSyntaxCheck(gitInfo.repo, info.changed);
		return true;
	});


} else if(options.action == "syntax_check")
{
	run(async ()=>{
		var config = getConfig();
		var gitInfo = new GitInfo(config.GIT.path);
		var options;
		
		var jsonPath = "/git_status.json";
		options = await tool.getFTPDeploymentInfo(
			config.ACCOUNT, 
			jsonPath
		);
		var latestHash = options && options.latest ? options.latest.hash : null;
		var gitFilter = options && options.latest ? {after:options.latest.authorDate} : {};

		var info = await gitInfo.getCommitInfo(
			gitFilter, 
			config.SYNC,
			latestHash
		);
		if(info) fileSyntaxCheck(localRoot, info.changed);
	});

} else if(options.action == "deploy")
{
	run(async ()=>{
		var config = getConfig();
		
		var gitInfo = new GitInfo(config.GIT.path);
		var options;
		if(config.TYPE == "FTP")
		{
			var jsonPath = "/git_status.json";
			options = await tool.getFTPDeploymentInfo(
				config.ACCOUNT, 
				jsonPath
			);
			var latestHash = options && options.latest ? options.latest.hash : null;
			var gitFilter = options && options.latest ? {after:options.latest.authorDate} : {};
			// gitFilter.repo = config.GIT.path;
			// gitFilter.branch = config.GIT.branch;
			
			var info = await gitInfo.getCommitInfo(
				gitFilter, 
				config.SYNC,
				latestHash
			);
			if(options)
			{
				var deploymentInfo = info.latest ? {latest:info.latest} : null;
				if(await tool.summarize(info))
				{
					await tool.uploadChanges(config.ACCOUNT, config.GIT, info );
				} else {
					console.log("\tAlready up to date.");
					// console.log("nothing has changed") ;
				}
				try{
					delete info.deleted;
					delete info.changed;
					delete info.latest.files;
					delete info.latest.status;
					await tool.save_summarize(config.ACCOUNT, info, "/git_status.json");
				} catch(err)
				{
					console.log(err);
				}
			}
		} else if(config.TYPE == "PHP")
		{
			options = await tool.getDeploymentInfo(
				config.SECRET, 
				config.URL
			);
			console.log("server status", options);
			var gitFilter = options && options.latest ? {after:options.latest.authorDate} : {};
			gitFilter.repo = config.REPOSITORY;
			
			var info = await gitInfo.getCommitInfo(
				gitFilter, 
				config.SYNC
			);
			// console.log("changes", info);
			console.log("zip files now");
			var deploymentInfo = info.latest ? {latest:info.latest} : null;
			var flag = await tool.zip(deploymentInfo, info, config.ZIP_FILE);
			if(!flag) {
				// console.log("not changes");
				return "not has changed";
			}
			if(options && options.latest && deploymentInfo.latest &&
				options.latest.hash == deploymentInfo.latest.hash &&
				options.latest.authorDate == deploymentInfo.latest.authorDate
			)
			{
				return "same commit";
			}
			// console.log("upload now");
			info = await tool.upload(
				config.SECRET, 
				config.URL, 
				config.ZIP_FILE
			);
			
			// console.log("upload result", info);
			
			info = await tool.deploy(config.SECRET, config.URL);
			// console.log("deploy result", info);
			return "completed";
		}
		return false;
		
	});
} else {
	console.error("unhandled action", JSON.stringify(options.action));
	exit(1);
}
function fileSyntaxCheck(localRoot, files)
{
	for(var i = 0;i < files.length;i++)
	{
		var file = files[i];
		var localFile = localRoot+file;
		var ext = path.extname(localFile);
		ext =  ext ? ext.toLowerCase() :"";
		var flag;
		if(!fs.existsSync(localFile))
		{
			throw `${localFile} - File NOT found - ❌`;
		}
		if(ext == ".json")
		{
			flag = jsonSyntaxCheck(localFile);
		} else if (ext === ".php")
		{
			// console.log(localFile);
			flag = phpSyntaxCheck(localFile);
		} else if(ext === ".ts")
		{
			flag = tsSyntaxCheck(localFile);
		} else if(ext == ".js")
		{
			flag = jsSyntaxCheck(localFile);
		} else {
			flag = true;
		}
		if(!flag)
		{
			throw `syntax check failed ${localFile} - ❌`;
		}
	}
}

function jsonSyntaxCheck(file) {
    var filename = path.basename(file);
    
    try {
        // Read the file content
        let content = fs.readFileSync(file, 'utf8');
		if(!content)
		{
			console.log(`${filename} - empty file - ❌`);
			return false;
		}
		
		content = content.replace(/\r/g, "\n");
		content = content.replace(/^\s*[\r\n]+/gm, "");
		content = content.replace(/\t/g, " ");
	
		try{
			JSON.parse(content);
		} catch(err)
		{
			console.log(`${filename} - ❌`);
			// Optional: Show line number and position of error
			const match = err.message.match(/at position (\d+)/);
			if (match) {
				const position = parseInt(match[1]);
				const lines = content.substring(0, position).split('\n');
				const lineNumber = lines.length;
				const columnNumber = lines[lines.length - 1].length + 1;
				const allLines = content.split('\n');
				const errorLine = allLines[lineNumber - 1];
				console.log(`  ${errorLine}`);
				console.log(`  ${' '.repeat(columnNumber - 1)}^`);
			}
			
			return false;
		}
        
        console.log(`${filename} - ✅`);
        return true;
    } catch (err) {
        // Output the error with details
        console.log(`${filename} - ❌`);
        console.log(`  Error: ${err.message}`);
        
        
        
        return false;
    }
}
function phpSyntaxCheck(file)
{
	var filename = path.basename(file);
	try {
		execSync(`php -l "${file}"`, { stdio: "pipe" }); // capture output
		console.log(`${filename} - ✅`);
		return true;
	} catch (err) {
		console.log(`${filename} - ❌`);
		return false;
	}
}


function jsSyntaxCheck(file)
{
	try {
		var filename = path.basename(file);
		execSync(`node --check "${file}"`, { stdio: "inherit" }); // capture output
		console.log(`${filename} - ✅`);
		return true;
	} catch (err) {
		console.log(`${filename} - ❌`);
		return false;
	}
}

function tsSyntaxCheck(file) {
    try {
		var filename = path.basename(file);
        execSync(`npx tsc --noEmit "${file}"`, { stdio: "inherit" });
        console.log(`${filename} - ✅`);
		return true;
    } catch (err) {
        // Get the full compiler output
        console.log(`${filename} - ❌`);
		return false;
        
    }
}