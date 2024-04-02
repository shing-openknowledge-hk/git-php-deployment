## requirement NODEJS 18 / PHP 7.3 + composer
	

## 1. start a project
npm init -y

## 2. install git-php-deployment command line tool
npm install https://github.com/shing-openknowledge-hk/git-php-deployment --save-dev

## 3. create config.json file
{
	"URL":"http://localhost:8000/",
	"ZIP_FILE":"dist/deployment.zip",
	"SECRET":"HELLO_WORLD",
	"REPOSITORY":"./",
	"SYNC":[
		"application/controllers/",
		"application/libraries/",
		"application/ro_library/"
	]
}

## 4. install php dependency
	goto autoload folder and run composer install

## 5. start php server using sample php 
	change default config.php MATCH config.json
	copy sample code to apache server

		or
	run php sample code directly 
		php -S localhost:8000 -t ./
## 6. check config and connection
	"node_modules/.bin/git-php-deploy" --config config.json --action verify
	
## 7. run deployment code
	"node_modules/.bin/git-php-deploy" --config config.json --action deploy
	
	
