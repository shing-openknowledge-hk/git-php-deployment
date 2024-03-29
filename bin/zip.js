const { exit, stdout, stderr, emitWarning } = require('node:process');
const ZipUtils = require('./ZipUtils');
var request = require('request');
var DeployTool = require("./DeployTool");

//curl -X POST http://jimnode.azurewebsites.net/api/jenkinsBuildEnd  -H "Content-Type: application/json" -d "{\"jobName\":\"%JOB_NAME%\", \"buildNum\": \"%BUILD_NUMBER%\"}"	
//http://localhost:8000/deploy?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIiLCJuYW1lIjoiaGVsbG8iLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTcwOTI4Nzk2NX0.rQpCgBZzdPsJcjcg7xp_piaK3hmCuSDvB_1YKnfleyk
// var deployPath = "http://localhost:8000/deploy";
// var deployPath = "https://dev.openknowledge.hk/RainbowOne/webapp/deploy/";
var deployPath = process.env.DEPLOYMENT_URL;

var tool = new DeployTool(deployPath, process.env.DEPLOYMENT_JWT);
tool.zip().then((data)=>{
	console.log(data);
}).catch((reason)=>{
	if( reason instanceof Error)
	{
		console.error("error", reason.message);
	} else {
		console.error("error", reason);
	}
	exit(1);
});
