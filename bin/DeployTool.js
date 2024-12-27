const PATH = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const ZipUtils = require('./ZipUtils');
var request = require('request');
const FTPClient = require('./FTPClient');
module.exports = class DeployTool{
	constructor()
	{
		
		// path, secretKey
		// this.path = env.path;
		// this.secretKey = secretKey;
	}
	
	async verifyConfig(config)
	{
		if(config.TYPE == "FTP")
		{
			return this.verifyFTP(config.ACCOUNT);
		} else if(config.TYPE == "PHP")
		{
			return this.verifyPHP(config.URL, config.SECRET);
		}
		return true;
	}

	async verifyFTP(account)
	{
		if(!(account && account.host && account.port && account.user && account.password))
		{
			throw( new Error("401 missing account info")   );
		};
		console.log(account.host, account.port, account.user);
		var client = new FTPClient(account);
		await client.verify();
		return true;
	}

	async verifyPHP(url, secretKey)
	{
		var token = this.sign(secretKey, "verify");
		const response = await fetch(url +"?action=verify", {
			method: 'POST',
			body: JSON.stringify({}),
			headers: {
				"Authorization": `Bearer ${token}`
			}
		});
		if(response.status != 200)
		{
			var text = await response.text();
			return Promise.reject({
				status:response.status,
				text:text
			});
		}
		var text = await response.text();
		try{
			return JSON.parse(text);
		} catch(err)
		{
			throw( new Exception(text) );
		}
	}

	async save_summarize(account, info, path)
	{
		var client = new FTPClient(account);
		await client.connect();
		try{
			await client.upload_json(info, path);
		} catch(err)
		{
			throw(new Error("failed to save summary");
		}
		await client.close();
	}

	summarize(info)
	{
		if(!(info.deleted.length || info.changed.length))
		{
			return false;
		}
		
		var count = 0;
		for(var i = 0;i < info.changed.length;i++)
		{
			var file = info.changed[i];
			count ++;
		}
		for(var i = 0;i < info.deleted.length;i++)
		{
			var file = info.deleted[i];
			count++;
		}
		return count > 0;
	}
	unique(arr) {
		return [...new Set(arr)];
	}
	
	async uploadChanges(account, gitInfo, info)
	{
		var client = new FTPClient(account);
		await client.connect();
		var localRoot = gitInfo.path;
		var folders = [];
		// getFolders
		// console.log("check folders");
		for(var i = 0;i < info.changed.length;i++)
		{
			var file = info.changed[i];
			var localFile = localRoot+file;
			var serverFile = "/"+file;
			folders.push(PATH.dirname(serverFile));
		}
		folders = this.unique(folders);
		if(folders.length)
		{
			// console.log("creating folders");
			for(var i = 0;i < folders.length;i++)
			{
				var folder = folders[i];
				console.log("\t+", folder);
				await client.mkdir(folder);
			}
		}
		// console.log("updating contents");
		for(var i = 0;i < info.changed.length;i++)
		{
			var file = info.changed[i];
			var localFile = localRoot+file;
			var serverFile = "/"+file;
			console.log("\t+", serverFile);
			await client.upload(localFile, serverFile);
		}
		
		for(var i = 0;i < info.deleted.length;i++)
		{
			var file = info.deleted[i];
			var serverFile = "/"+file;
			console.log("\t-", serverFile);
			try{
				await client.remove(serverFile);
			} catch(err)
			{
				if(err.name == "Error" && err.code == 550)
				{
					// console.error(path, "file not found");
				} else {
					console.error("remove error",{
						name:err.name,
						code:err.code,
						message:err.message
					});
				}
			}
			
		}
		
		client.close();
		return true;
	}

	async zip(deploymentInfo, info, path)
	{
		if(!(info.deleted.length || info.changed.length))
		{
			console.log("Nothing has changed");
			return false;
		}
		var zip = new ZipUtils();
		await zip.add("deployment.json", JSON.stringify(deploymentInfo));
		
		for(var i = 0;i < info.changed.length;i++)
		{
			var file = info.changed[i];
			if(fs.existsSync(file))
			{
				await zip.addFile(file, file);
			}
		}
		for(var i = 0;i < info.deleted.length;i++)
		{
			var file = info.deleted[i];
			await zip.add(file, "");
		}
		await zip.save(path);
		return true;
	}

	async getFTPDeploymentInfo(account, path)
	{
		var client = new FTPClient(account);
		await client.connect();
		try{
			var output = await client.get_json_file(path)
		} catch(err)
		{
			if(err.name == "Error" && err.code == 550)
			{
				console.error(path, "file not found");
			} else {
				console.error({
					name:err.name,
					code:err.code,
					message:err.message
				});
			}
			
			// console.log(err.code);
			output = null;
		}
		await client.close();
		return output;
	}
	
	async getFTPFile(account, path)
	{
		var client = new FTPClient(account);
		await client.connect();
		await client.close();
	}

	async getDeploymentInfo(secretKey, url)
	{
		var token = this.sign(secretKey, "deploy_status");
		var fullURL = url +"?action=deploy_status";
		console.log(fullURL);
		const response = await fetch(fullURL, {
			method: 'POST',
			body: JSON.stringify({}),
			headers: {
				"Authorization": `Bearer ${token}`
			}
		});
		if(response.status != 200)
		{
			var text = await response.text();
			return Promise.reject({
				status:response.status,
				text:text
			});
		}
		var text = await response.text();
		try{
			return JSON.parse(text);
		} catch(err)
		{
			console.log(text);
			throw( new Exception(text) );
		}
	}
	
	upload(secretKey, uploadURL, localFile){
		return new Promise((resolve, reject)=>{
			var token = this.sign(secretKey, "upload");
			var data = {
				file:fs.createReadStream( localFile )
			};
			request.post({ 
				url:`${uploadURL}?action=upload`, 
				headers : { 
					'Content-Type' : 'multipart/form-data' ,
					"Authorization": `Bearer ${token}`
				},
				formData:data 
			}, 
			function callback( err, response, body ) {
				if( err ) {
					reject(err);
					return; 
				}
				
				if(response.statusCode != 200)
				{
					reject({statusCode:response.statusCode, body:response.body});
					return;
				}
				resolve(response.body);
			});
		});
		
	};
	sign(secretKey, action)
	{
		// var now = Date.now();// Math.floor(new Date().getTime()/ 1000);
		// console.log(Date.now() / 1000);
		var now = Math.floor(Date.now()/ 1000);
		// console.log(now);
		var exp = now + 60;
		return jwt.sign(
			{ 
				iss:"jenkins",
				action:"deploy",
				iat: now, 
				exp:exp 
			}, 
			secretKey
		);
	}
	async deploy(secretKey, path)
	{
		var token = this.sign(secretKey, "deploy");
		const response = await fetch(path +"?action=deploy", {
			method: 'POST',
			// body:"jwt="+token
			body: JSON.stringify({
				// action:"deploy",
				// target:option.target,
				// zip:option.zip
			}),
			headers: {
				// 'Content-Type': 'application/json'
				"Authorization": `Bearer ${token}`
			}
		});
		if(response.status != 200)
		{
			var text = await response.text();
			return Promise.reject({
				status:response.status,
				text:text
			});
		}
		var text = await response.text();
		try{
			return JSON.parse(text);
		} catch(err)
		{
			throw( new Exception(text) );
		}
	}
}
