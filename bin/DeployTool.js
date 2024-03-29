const jwt = require('jsonwebtoken');
const fs = require('fs');
const ZipUtils = require('./ZipUtils');
var request = require('request');
module.exports = class DeployTool{
	constructor()
	{
		
		// path, secretKey
		// this.path = env.path;
		// this.secretKey = secretKey;
	}
	async curl()
	{
		
	}
	async verify(url, secretKey)
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
