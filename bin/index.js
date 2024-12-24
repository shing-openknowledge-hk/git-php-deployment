#!/usr/bin/env node

const { exit, stdout, stderr, emitWarning } = require('node:process');
const fs = require("fs");
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
	var configString = fs.readFileSync(options.config);
	var config = JSON.parse(configString +"");	
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
		var gitInfo = new GitInfo();
		if(config.TYPE == "FTP")
		{
			// var jsonPath = "/git_status.json";
			// options = await tool.getFTPDeploymentInfo(config.ACCOUNT, jsonPath);
			var latestCommit = gitInfo.getLastestCommit();
			if(latestCommit)
			{
				delete latestCommit.files;
				delete latestCommit.status;
				console.info("latestCommit", latestCommit)
				console.info("writing git_status.json to server");
				await tool.save_summarize(config.ACCOUNT, {latest:latestCommit}, "/git_status.json");
			} else {
				console.error("no commit is found");
			}
		};
		return "init COMPLETED";
	});
} else if(options.action == "deploy")
{
	run(async ()=>{
		var config = getConfig();
		
		var gitInfo = new GitInfo();
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
			gitFilter.repo = config.GIT.path;
			gitFilter.branch = config.GIT.branch;
			
			var info = gitInfo.getCommitInfo(
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
			
			var info = gitInfo.getCommitInfo(
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
}