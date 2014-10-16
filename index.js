var _ = require('lodash'),
	path = require('path'),
	fs = require('fs'),
	utils = require('./utils'),
	through = require('through2'),
	gulpUtil = require('gulp-util'),
	PluginError = gulpUtil.PluginError,
	exec = require('child_process').exec,
	PLUGIN_NAME = 'gulp-tfs-commander',

	defaults = {
		tfs: 'tf',
		command: 'edit',
		debug: false
	};
var AddVSLocationToPath = function(){
	var platformPathSeporator = process.platform === 'win32'?';':':';
	var pathToAdd = '';
	if(process.env.VS120COMNTOOLS){
		pathToAdd += platformPathSeporator;
		pathToAdd += path.resolve(process.env.VS120COMNTOOLS, '..\\IDE\\');
	}
	if(process.env.VS110COMNTOOLS){
		pathToAdd += platformPathSeporator;
		pathToAdd += path.resolve(process.env.VS110COMNTOOLS, '..\\IDE\\');
	}
	if(process.env.VS100COMNTOOLS){
		pathToAdd += platformPathSeporator;
		pathToAdd += path.resolve(process.env.VS100COMNTOOLS, '..\\IDE\\');
	}
	process.env['PATH'] += pathToAdd;
}
var gulpTfs = module.exports = function(opts) {
	opts = _.extend({}, defaults, opts);
	var files = [];
	
	return through.obj(function(file, encoding, callback) {
	var hasUnlocked = false;
	var self = this;

		if (!fs.existsSync(file.path)) {
			gulpUtil.log('file "' + gulpUtil.colors.cyan(file.path) + ' doesn\'t exist' );
			this.push(file);
			return callback();
		}

		if (hasUnlocked) {
			gulpUtil.log('file "' + gulpUtil.colors.cyan(file.path) + '" already unlocked' );
			this.push(file);
			return callback();
		}
		files.push('"'+ file.path+'"');
		self.push(file);
		callback();
		
	}, function(cb){
		paths = files.join(' ');
		var command = utils.generateCommand(opts.tfs, opts.command + ' '+ paths + ' ' + utils.zipParams(opts.params));
		return exec(command, function(err, stdout, stderr) {
			if (opts.debug) {
				processExecResults(err, stdout, stderr);
				//stdout = stdout.split('\r\n');
				gulpUtil.log('TFS result: command ' + opts.command + ' on file(s)\r\n' + gulpUtil.colors.cyan(stdout));
			}
			hasUnlocked = true;
			cb();
		})
		
	});
};

var direct = function(opts, file) {
	opts = _.extend({}, defaults, opts);

	var hasUnlocked = false;
	return through.obj(function(f, encoding, callback) {
		var self = this;

		if (!fs.existsSync(file)) {
			this.push(f);
			return callback();
		}

		if (hasUnlocked) {
			this.push(f);
			return callback();
		}

		var command = utils.generateCommand(opts.tfs, opts.command + ' "' + file + '" ' + utils.zipParams(opts.params));
		return exec(command, function(err, stdout, stderr) {
			if (opts.debug) {
				processExecResults(err, stdout, stderr);
				utils.log('TFS result: command ' + opts.command + ' on file ' + gulpUtil.colors.cyan(stdout));
			}
			hasUnlocked = true;
			self.push(f);
			callback();
		});
	});
};

var processExecResults = function(err, stdout, stderr) {
	if (stderr) {
		utils.log('TFS command error: ' + gulpUtil.colors.cyan(stderr) + ' -- ' + gulpUtil.colors.red(stderr));
		return stderr;
	}

	if (err) {
		utils.log('TFS command caution: ' + gulpUtil.colors.cyan(stdout) + ' -- ' + gulpUtil.colors.yellow(err));
		return err;
	}

	return stdout;
};

var checkForTFS = function(opts, done) {
	var command = utils.generateCommand(opts.tfs, 'bob');
	exec(command, function(err, stdout, stderr) {
		// not a tf command, but validates that tf throws the right error
		// this ensures that the tf command is available
		if (stderr === 'Unrecognized command: bob.\r\n') {
			return done();
		}

		throw new PluginError(PLUGIN_NAME, 'TF command is not available. Make sure Visual Studio is installed and its install directory is in your %PATH%');
	});
};
AddVSLocationToPath();
_.extend(gulpTfs, {
	checkForTFS: checkForTFS,
	direct: direct,
	config: function(opts) {
		_.extend(defaults, opts);
		return gulpTfs;
	}
});

