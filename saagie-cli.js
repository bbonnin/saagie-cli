const vorpal = require('vorpal')();
const fs = require('fs');
const chalk = require('chalk');
const _ = require('lodash');

// Initialisation

// - configuration env
let cliHome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
cliHome += '/.saagie-cli';

if (!fs.existsSync(cliHome)) {
    fs.mkdirSync(cliHome)
}

let config = { platforms: [] };

if (fs.existsSync(cliHome + '/config.json')) {
    const content = fs.readFileSync(cliHome + '/config.json');
    config = JSON.parse(content);
}

// - commands

vorpal
    .command('platforms <action> [parameters...]')
    .alias('pf')
    .autocomplete(['list', 'add', 'remove'])
    .action(processPf);

function processPf(args, callback) {
    if (args.action === 'list') {
        if (config.platforms.length > 0) {
            config.platforms.forEach(p => this.log(chalk.bold(p.name) + ' (' + p.url + ')'));
        }
        else {
            this.log(chalk.red('No platforms'));
        }
    }
    else if (args.action === 'add') {
        if (args.parameters.length === 2) {
            const pf = { name: args.parameters[0], url: args.parameters[1] };
            config.platforms.push(pf);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: pf add <name> <url>'));
        }
    }
    else if (args.action === 'remove') {
        if (args.parameters.length === 1) {
            _.remove(config.platforms, p => p.name === args.parameters[0]);
            saveConfig();
        }
        else {
            this.log(chalk.red('ERROR! Usage: pf remove <name>'));
        }
    }

    callback();
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

vorpal
  .delimiter('>')
  .show();