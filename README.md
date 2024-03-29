## 1. start a project
npm init -y

## 2. install git-php-deployment command line tool
npm install https://github.com/shing-openknowledge-hk/git-php-deployment --save-dev

## 3. create config.json file
{
	"DEPLOYMENT_ZIP_FILE":"dist/deployment.zip",
	"DEPLOYMENT_JWT":"HELLO_WORLD",
	"DEPLOYMENT_URL":"http://localhost/deploy/"
}
## 4. start php server using sample php 
	copy sample code to php server
	
## 5. check config and connection
	"node_modules/.bin/git-php-deploy" --config config.json --action verify
	
## 6. run deployment code
	"node_modules/.bin/git-php-deploy" --config config.json --action deploy
	
	