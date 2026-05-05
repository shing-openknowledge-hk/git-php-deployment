// const gitlog = require("gitlog").default;
const gitlog = require("./gitlog.js").default;

class GitInfo
{
	repo = null;
	constructor(repo = null)
	{
		this.repo = repo;
	}
	
	match(path, includedPaths)
	{
		return includedPaths.filter((p)=>{
			var index = path.indexOf(p);
			// if(index == 0) console.log(p, path);
			return index === 0;
		}).length > 0;
	}
	async getLastestCommit()
	{
		var gitOption = {
			number:1,
			repo: this.repo ? this.repo : __dirname ,
			includeMergeCommitFiles:true
		};
		var commits = await gitlog(gitOption);
		if(commits.length ) return commits[0];
		return null;
	}
	async gitlog(gitOption)
	{
		if(!gitOption)
		gitOption = {};
		Object.assign(gitOption, {
			repo: this.repo ? this.repo : __dirname ,
			includeMergeCommitFiles:true
		})
		return await gitlog(gitOption);
	}
	
	async getCommitInfo(option, includedPaths, hash = null)
	{
		var gitOption = {
			repo: this.repo ? this.repo : __dirname ,
			includeMergeCommitFiles:true,
			fields: [
				"subject", 
				"authorDate",
				"authorName",
				"authorEmail",
				"committerDate",
				"committerName",
				"committerEmail",
			]
		};
		if(option)
		{
			for(var key in option)
			{
				gitOption[key] = option[key];
			}
		}
		// console.log("gitOption", gitOption)
		var commits = await gitlog(gitOption);
		var deletedFiles = [];
		var changedFiles = [];
		var map = {};
		commits.forEach((commit, index)=>{
			// console.log("commit", index, commit);
			if(commit.hash !== hash)
			{
				commit.files.forEach((file, index)=>{
					if(includedPaths && this.match.call(null, file, includedPaths) == false) return;
					if(map.hasOwnProperty(file))
					{
						return;
					}
					map[file] = 1;
					var status = commit.status[index];
					if(status == "A" || status == "M")
					{// Append // Modify
						changedFiles.push(file);
					} else if(status == "D")
					{// Delete
						deletedFiles.push(file);
					}
				});
			}
		});
		var now = new Date().toISOString();
		return {
			commits:commits,
			count:commits.length,
			deleted:deletedFiles,
			changed:changedFiles,
			now:now,
			latest:commits.length ? commits[0] : null
		};
	}
	
}


module.exports = GitInfo;
