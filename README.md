## requirement NODEJS 18 / PHP 7.3 + composer
	

## 1. start a project
npm init -y

## 2. install git-php-deployment command line tool
npm install https://github.com/shing-openknowledge-hk/git-php-deployment --save-dev

## 3. create config.json file
```
{
	"TYPE":"PHP",
	"URL":"http://localhost:8000/",
	"ZIP_FILE":"dist/deployment.zip",
	"SECRET":"HELLO_WORLD",
	"REPOSITORY":"../git/",
	"SYNC":[
		"application/controllers/",
		"application/libraries/",
		"application/ro_library/"
	]
}
OR
{
	"TYPE":"FTP",
	"ACCOUNT":{
		"host":"",
		"port":21,
		"user":"",
		"password":"",
		"root":"/site/wwwroot"
	},
	"GIT":{
		"path":"R:/git.checkout/",
		"branch":"uat"
	},
	"SYNC":[
		"application/controllers/",
		"application/libraries/",
		"application/ro_library/"
	]
}
```


## 4. install php dependency
	goto autoload folder and run composer install

## 5. start php server using sample php 
```
	change default config.php MATCH config.json
	copy sample code to apache server

		or
	run php sample code directly 
		php -S localhost:8000 -t ./

**remark : change php.ini for max upload file limit 
	upload_max_filesize = 500M
	post_max_size = 500M

```

方法一 Directly Call Command
## 6. check config and connection
	"node_modules/.bin/git-php-deploy" --config config.json --action verify
	
## 7. run deployment code
	"node_modules/.bin/git-php-deploy" --config config.json --action deploy
方法二
##6 using package.json
modify package.json
```
{
	"script":{
		"verify":"npx git-php-deploy --config config.json --action verify",
		"deploy":"npx git-php-deploy --config config.json --action deploy"
	}
}
run verify command
	npm run verify
run deploy command
	npm run deploy
```
	
	
