

const PATH = require('path');
var Client = require('ftp');
var fs = require('fs');
const { Readable } = require('stream');

class FTPClient
{
	/*
		host - string - The hostname or IP address of the FTP server. Default: 'localhost'
		port - integer - The port of the FTP server. Default: 21
		secure - mixed - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false
		secureOptions - object - Additional options to be passed to tls.connect(). Default: (none)
		user - string - Username for authentication. Default: 'anonymous'
		password - string - Password for authentication. Default: 'anonymous@'
		connTimeout - integer - How long (in milliseconds) to wait for the control connection to be established. Default: 10000
		pasvTimeout - integer - How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000
		keepalive - integer - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000
	*/
	constructor(account)
	{
		this.account = account;
		this.client = new Client();
	}
	get_full_path(path)
	{
		var full = this.account.root + path;
		// console.log(full);
		return full;
	}
	stream_to_string(readStream)
	{
		return new Promise((resolve, reject)=>{
			const chunks = [];
			readStream.on("data", (chunk)=>{
				chunks.push(chunk);
			});
			// Send the buffer or you can put it into a var
			readStream.on("end", ()=>{
				var text = Buffer.concat(chunks).toString("utf8");
				resolve(text);
			});
		});
	}
	async get_json_file(path)
	{
		var text = await this.get_text_file(path);
		return JSON.parse(text);
	}
	
	async get_text_file(path)
	{
		var stream = await this.get_file_stream(path);
		var text = await this.stream_to_string(stream);
		return text;
	}

	get_file_stream(path)
	{
		return new Promise((resolve, reject)=>{
			this.client.get(this.get_full_path(path), 
				async (err, stream)=>{
					if (err) {
						reject(err);
					} else {
						resolve(stream);
					}
				}
			)
		});
	}

	async upload_json(json, path)
	{
		return await this.upload_text_content(JSON.stringify(json, null, "\t"), path);
	}

	stringToStream(text) {
		const stream = new Readable();
		stream.push(text);
		stream.push(null); // Signifies the end of the stream
		return stream;
	}
	upload_text_content(content, path)
	{
		var fullPath = this.get_full_path(path);
		return new Promise((resolve, reject)=>{
			var buffer = Buffer.from(content, "utf-8");
			this.client.put(buffer, fullPath, (err)=>{
				if (err) reject(err);
				else resolve();
			});
		});
	}
	mkdir_for_file(file_path)
	{
		var folder = PATH.dirname(file_path);
		return this.mkdir(folder);
	}
	mkdir(path)
	{
		var fullPath = this.get_full_path(path);
		// console.log("mkdir", fullPath);
		return new Promise((resolve, reject)=>{
			this.client.mkdir(fullPath, true, (err)=>{
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	upload(localFile, serverPath)
	{
		// await client.mkdir("/application/ro_library");
		var fullPath = this.get_full_path(serverPath);
	
		// console.log("start upload", localFile, fullPath);
		return new Promise((resolve, reject)=>{
			this.client.put(localFile, fullPath, (err)=>{
				// console.log("error", err);
				if (err) {
					// console.log("reject");
					reject(err);
					throw err;
				} else {
					// console.log("resolve");
					// c.end();
					resolve();
				}
			});
		});
	}
	async remove(path)
	{
		// console.log("removing", path);
		return new Promise((resolve, reject)=>{
			var fullPath = this.get_full_path(path);
			this.client.delete(fullPath,(err)=>{
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	async verify()
	{
		await this.connect();
		await this.close();
	}
	connect()
	{
		return new Promise((resolve, reject)=>{
			this.client.on('ready', function() {
				// console.log("connected");
				// c.end();
				resolve("connected");
			});
			// connect to localhost:21 as anonymous
			this.client.connect(this.account);
		});
	}
	close()
	{
		this.client.end();
	}
	
}

/*
var account = {
	  host:"",
	  user:"",
	  password:""
}
async function test_upload()
{
	var client = new FTPClient(account);
	await client.connect();
	await client.upload("demo.txt", "/site/wwwroot/test/upload/demo.txt");
	client.close();
}
test_upload();*/
module.exports = FTPClient;
/*
var c = new Client();
c.on('ready', function() {
  console.log("ready");
	c.put('foo.txt', 'foo.remote-copy.txt', function(err) {
	  if (err) throw err;
	  c.end();
	});
	
c.end();
});
// connect to localhost:21 as anonymous
c.connect();
*/