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
	getCommitInfo(option, includedPaths, hash = null)
	{
		var gitOption = {
			// branch :"master",
			repo: this.repo ? this.repo : __dirname ,
			includeMergeCommitFiles:true
			// execOptions: { maxBuffer: 1000 * 1024 },
			// after:"2024-03-27 16:33:26 +0800"
		};
		if(option)
		{
			for(var key in option)
			{
				gitOption[key] = option[key];
			}
		}
		// console.log("gitOption", gitOption)
		var commits = gitlog(gitOption);
		var deletedFiles = [];
		var changedFiles = [];
		var map = {};
		commits.forEach((commit, index)=>{
			// console.log("commit", index, commit);
			if(commit.hash !== hash)
			{
				commit.files.forEach((file, index)=>{
					if(this.match.call(null, file, includedPaths) == false) return;
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
			count:commits.length,
			deleted:deletedFiles,
			changed:changedFiles,
			now:now,
			latest:commits.length ? commits[0] : null
		};
	}
	
}


module.exports = GitInfo;
