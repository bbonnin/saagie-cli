#!/usr/bin/env node

const vorpal = require('vorpal')();
const fs = require('fs');
const chalk = require('chalk');
const axios = require('axios');
const _ = require('lodash');


// Initialisation

// - configuration env
let cliHome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
cliHome += '/.saagie-cli';

if (!fs.existsSync(cliHome)) {
    fs.mkdirSync(cliHome)
}

let config = { datafabrics: [] };

if (fs.existsSync(cliHome + '/config.json')) {
    const content = fs.readFileSync(cliHome + '/config.json');
    config = _.merge(config, JSON.parse(content));

}

let activeFabric = undefined;
let fabricAuth = undefined;
let activePlatform = undefined;

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


// - commands

vorpal
    .command('datafabrics <action> [parameters...]')
    .alias('df')
    .autocomplete(['list', 'add', 'remove', 'connect'])
    .action(processDf);

vorpal
    .command('platforms <action> [parameters...]')
    .alias('pf')
    .autocomplete(['list', 'connect'])
    .action(processPf);

// Functions

function processPf(args, callback) {
    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (args.action === 'list') {
        invokeCB = false;
        getPlatformList(fabricAuth)
            .then(err => {
                callback();
            });
    }
    else if (args.action === 'connect') {
        if (args.parameters.length === 1) {

            // NEXT STEP IS HERE !!!!!!!!
        }
        else {
            this.log(chalk.red('ERROR! Usage: pf connect <id>'));
        }
    }

    if (invokeCB) {
        callback();
    }
}

function processDf(args, callback) {
    let invokeCB = true;
    args = _.merge({ parameters: [] }, args);

    if (args.action === 'list') {
        if (config.datafabrics.length > 0) {
            config.datafabrics.forEach(f => this.log(chalk.bold(f.name) + ' (' + f.url + ')'));
        }
        else {
            this.log(chalk.red('No datafabrics'));
        }
    }
    else if (args.action === 'add') {
        if (args.parameters.length === 2) {
            const pf = { name: args.parameters[0], url: args.parameters[1] };
            config.datafabrics.push(pf);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: df add <name> <url>'));
        }
    }
    else if (args.action === 'remove') {
        if (args.parameters.length === 1) {
            _.remove(config.datafabrics, f => f.name === args.parameters[0]);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: df remove <name>'));
        }
    }
    else if (args.action === 'connect') {
        if (args.parameters.length === 1) {
            const idxDf = _.findIndex(config.datafabrics, df => df.name === args.parameters[0]);
            if (idxDf === -1) {
                this.log(chalk.red('ERROR! Unknown datafabric'));
            }
            else {
                activeFabric = config.datafabrics[idxDf];
                invokeCB = false;
                this.prompt([usernamePrompt, passwordPrompt],
                    (results) => {
                        getPlatformList(results)
                        .then(err => {
                            if (!err) {
                                fabricAuth = results;
                                vorpal.delimiter(activeFabric.name + ' >');
                            }
                            callback();
                        });
                });
            }
        }
        else {
            this.log(chalk.red('ERROR! Usage: df connect <name>'));
        }
    }

    if (invokeCB) {
        callback();
    }
}

function getPlatformList(auth) {
    return axios.get(activeFabric.url + '/api/v1/platform', { auth: auth })
        .then(response => {
            vorpal.log('\nAvailable platforms on ' + chalk.bold(activeFabric.name));
            response.data.forEach(pf => vorpal.log(chalk.bold(pf.id) + ' - ' + pf.name));
            //response.headers['set-cookie']
        })
        .catch(error => {
            vorpal.log(chalk.red('ERROR! Platform list: ' + error));
            return error;
        });
}

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

vorpal.log(chalk.inverse.bold('Welcome to Saagie CLI'));

vorpal
  .delimiter('>')
  .show();