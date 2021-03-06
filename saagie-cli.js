#!/usr/bin/env node

const vorpal = require('vorpal')();
const fs = require('fs');
const chalk = require('chalk');
const prettyjson = require('prettyjson');
const axios = require('axios');
const url = require('url') ;
const clui = require('clui');
const filesize = require('filesize');
const _ = require('lodash');


// ----------------
// Global variables
// ----------------

const context = {};

const usernamePrompt = {
    name: 'username',
    type: 'input',
    message: 'Datafabric username? '
};
 
const passwordPrompt = {
    name: 'password',
    type: 'password',
    message: 'Datafabric password? '
};

const cliHome = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.saagie-cli';


// --------------
// Initialisation
// --------------

if (!fs.existsSync(cliHome)) {
    fs.mkdirSync(cliHome)
}

let config = { datafabrics: [] };

if (fs.existsSync(cliHome + '/config.json')) {
    const content = fs.readFileSync(cliHome + '/config.json');
    config = _.merge(config, JSON.parse(content));
}


// --------------------------
// VORPAL commands definition
// --------------------------

vorpal
    .command('datafabric <action> [parameters...]')
    .alias('d')
    .autocomplete(['list', 'add', 'remove', 'connect'])
    .action(processDatafabrics);

vorpal
    .command('platform <action> [parameters...]')
    .alias('p')
    .autocomplete(['list', 'connect'])
    .action(processPlatforms);

vorpal
    .command('job <action> [parameters...]')
    .alias('j')
    .autocomplete(['list', 'info', 'run', 'stop'])
    .action(processJobs);

vorpal
    .command('operation <action> [parameters...]')
    .alias('o')
    .autocomplete(['stats'])
    .action(processOperations);

vorpal
  .command('grep [filter] [words...]')
  .hidden()
  .action(function (args, callback) {
    if (chalk.reset(args.stdin).indexOf(args.filter) != -1) {
        this.log(chalk.reset(args.stdin));
    }
    callback();
  });


// ------------------
// Processing actions
// ------------------

const jobFunctions = {
    run: runJob,
    stop: stopJob,
    info: getJobInfo
};

function processJobs(args, callback) {
    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (!context.platform) {
        this.log(chalk.red('ERROR! You are not connected to a platform'));
    }
    else if (args.action === 'list') {
        invokeCB = false;
        getJobList(callback, this);
    }
    else if (jobFunctions[args.action]) {
        const fct = jobFunctions[args.action];
        if (args.parameters.length === 1) {
            invokeCB = false;
            fct(args.parameters[0], callback, this);
        }
        else {
            this.log(chalk.red('ERROR! Usage: job ' + args.action + ' <id>'));
        }
    }

    if (invokeCB) {
        callback();
    }
}

function processPlatforms(args, callback) {
    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (!context.fabric) {
        this.log(chalk.red('ERROR! You are not connected to a data fabric'));
    }
    else if (args.action === 'list') {
        invokeCB = false;
        getPlatformList(callback, this);
    }
    else if (args.action === 'connect') {
        if (args.parameters.length === 1) {
            const pf = _.findLast(context.platforms, pf => pf.id == args.parameters[0]);

            if (pf) {
                context.platform = pf;
                vorpal.delimiter(context.fabric.name + ' | ' + context.platform.name + ' >');
            }
            else {
                this.log(chalk.red('ERROR! Unknown platform'));
            }
        }
        else {
            this.log(chalk.red('ERROR! Usage: platform connect <id>'));
        }
    }

    if (invokeCB) {
        callback();
    }
}

function processDatafabrics(args, callback) {
    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (args.action === 'list') {
        if (config.datafabrics.length > 0) {
            config.datafabrics.forEach(f => this.log(chalk.bold(f.name) + ' (' + f.url + ')'));
        }
        else {
            this.log(chalk.red('No data fabrics'));
        }
    }
    else if (args.action === 'add') {
        if (args.parameters.length === 2) {
            const pf = { name: args.parameters[0], url: args.parameters[1], api: args.parameters[1] + '/api/v1/platform' };
            config.datafabrics.push(pf);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: datafabric add <name> <url>'));
        }
    }
    else if (args.action === 'remove') {
        if (args.parameters.length === 1) {
            _.remove(config.datafabrics, f => f.name === args.parameters[0]);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: datafabric remove <name>'));
        }
    }
    else if (args.action === 'connect') {
        if (args.parameters.length === 1) {
            const idxDf = _.findIndex(config.datafabrics, df => df.name === args.parameters[0]);
            if (idxDf === -1) {
                this.log(chalk.red('ERROR! Unknown data fabric'));
            }
            else {
                context.fabric = config.datafabrics[idxDf];
                invokeCB = false;
                this.prompt([usernamePrompt, passwordPrompt], (results) => authenticate(results, callback, this));
            }
        }
        else {
            this.log(chalk.red('ERROR! Usage: datafabric connect <name>'));
        }
    }

    if (invokeCB) {
        callback();
    }
}

function processOperations(args, callback) {

    //this.log(chalk.red('Not supported'));
    //callback();

    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (!context.fabric) {
        this.log(chalk.red('ERROR! You are not connected to a data fabric'));
    }
    else if (args.action === 'stats') {
        invokeCB = false;
        getStats(callback, this);
    }

    if (invokeCB) {
        callback();
    }
}


// ------------------------------
// Functions using the Saagie API
// ------------------------------

function getPlatformUrl() {
    return context.fabric.url + '/api/v1/platform'
}

function bytesToHumanReadable(size) {
    var i = Math.floor( Math.log(size) / Math.log(1024) );
    return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function getStats(callback, ctx) {
    let origin = url.parse(context.fabric.url);
    origin = origin.protocol + '//' + origin.host;
    axios.get(origin + '/operations/api/stats', 
        { 
            auth: context.auth,
            headers: {
                'Cookie': context.cookie,
                'Saagie-Realm': 'saagie'
            }
        })
        .then(response => {
            response.data.platforms.forEach(pf => {
                const platform = _.findLast(context.platforms, p => p.id == pf.id);
                ctx.log(chalk.bold('\nPlatform: ' + (platform ? platform.name : pf.id)));

                _.keys(pf.stats).forEach(nodeType => {
                    const used = pf.stats[nodeType].used;
                    const total = pf.stats[nodeType].total;
                    ctx.log(chalk.bold(nodeType) + ': ' + pf.stats[nodeType].size + ' node(s)');

                    let human = used.cpu.toFixed(2) + ' CPU / ' + total.cpu + ' CPU';
                    ctx.log('\tCPU:\t' + clui.Gauge(used.cpu, total.cpu, 20, total.cpu * 0.8, human));

                    human = filesize(used.disk * 1000 * 1000, {base: 10}) + ' / ' + filesize(total.disk * 1000 * 1000, {base: 10});
                    ctx.log('\tDisk:\t' + clui.Gauge(used.disk, total.disk, 20, total.disk * 0.8, human));

                    human = filesize(used.ram * 1000 * 1000, {base: 10}) + ' / ' + filesize(total.ram * 1000 * 1000, {base: 10});
                    ctx.log('\tRAM:\t' + clui.Gauge(used.ram, total.ram, 20, total.ram * 0.8, human));
                })
            });
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Operation stats: ' + error));
        })
        .finally(() => callback());
}

function authenticate(auth, callback, ctx) {
    axios.get(context.fabric.url + '/api/auth', { auth: auth })
        .then(response => {
            context.auth = auth;
            context.cookie = response.headers['set-cookie'];
            vorpal.delimiter(context.fabric.name + ' >');
            getPlatformList(null, null);
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Authenticate: ' + error));
        })
        .finally(() => callback());
}

function getPlatformList(callback, ctx) {
    axios.get(getPlatformUrl(), { auth: context.auth })
        .then(response => {
            context.platforms = response.data;

            if (ctx) {
                ctx.log('\nAvailable platforms on ' + chalk.bold(context.fabric.name));
                response.data.forEach(pf => ctx.log(chalk.bold(pf.id) + ' - ' + pf.name));
                ctx.log();
            }
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Platform list: ' + error));
        })
        .finally(() => { if (callback) callback() });
}

function getJobList(callback, ctx) {
    axios.get(getPlatformUrl() + '/' + context.platform.id + '/job', { auth: context.auth })
        .then(response => {
            ctx.log('\nAvailable jobs on ' + chalk.bold(context.platform.name));
            response.data.forEach(job => {
                let status = job.last_state ? job.last_state.lastTaskStatus : 'NEVER_LAUNCHED';
                if (status === 'SUCCESS') status = chalk.green.bold(status);
                else if (status === 'NEVER_RUN' || status === 'NEVER_LAUNCHED') status = chalk.gray.bold(status);
                else if (status === 'PENDING') status = chalk.magenta.bold(status);
                else if (status === 'FAILED') status = chalk.red.inverse.bold(status);
                else if (status === 'KILLED') status = chalk.red.bold(status);
                else status = chalk.cyan.bold(status);
                ctx.log(chalk.bold(job.id) + ' - ' + job.name + ' - ' + status);
            });
            ctx.log();
            context.jobs = response.data;
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Job list: ' + error));
        })
        .finally(() => callback());
}

function getJobInfo(id, callback, ctx) {
    axios.get(getPlatformUrl() + '/' + context.platform.id + '/job/' + id, { auth: context.auth })
        .then(response => {
            const job = response.data;
            
            ctx.log(prettyjson.render(job, {
                keysColor: 'bold',
                stringColor: 'white'
            }));
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Job info: ' + error));
        })
        .finally(() => callback());
}

function runJob(id, callback, ctx) {
    axios.post(getPlatformUrl() + '/' + context.platform.id + '/job/' + id + '/run', null, { auth: context.auth })
        .then(response => {
            vorpal.log(chalk.green('OK, job launched!'));
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Run job: ' + error));
        })
        .finally(() => callback());
}

function stopJob(id, callback, ctx) {
    axios.post(getPlatformUrl() + '/' + context.platform.id + '/job/' + id + '/stop', null, { auth: context.auth })
        .then(response => {
            vorpal.log(chalk.green('OK, job stopped!'));
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Stop job: ' + error));
        })
        .finally(() => callback());
}


// --------------
// Misc functions
// --------------

function saveConfig() {
    fs.writeFile(cliHome + '/config.json', JSON.stringify(config), err => {
        if (err) {
            vorpal.log(chalk.red('ERROR when writing config file: ' + err));
        }
        else {
            vorpal.log(chalk.green('Config updated!'))
        }
    });
}


// -------------
// Let's go !!!!
// -------------

vorpal.log(chalk.inverse.bold('Welcome to Saagie CLI'));

vorpal
  .delimiter('>')
  .show();
