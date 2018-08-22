# saagie-cli
CLI tool for Saagie Open DataFabric

> At the moment, there are only read commands!


## Install

```sh
npm i -g saagie-cli
```


## Run

```sh
$ saagie
Welcome to Saagie CLI
> 
```


## Commands

* datafabric (alias: d)
```sh
> datafabric list
datafabric_demo (https://demo_saagie.example.com)
datafabric_test (https://test_saagie.example.com)

> datafabric add <name> <url>

> datafabric remove <name>

> datafabric connect <name>
Datafabric username? bob_le_bricoleur
Datafabric password? ****************************

Available platforms on datafabric_demo
4 - Dev
6 - Test
7 - Prod

datafabric_demo > 
```

* platform (alias: p)
```sh
datafabric_demo > platform list

Available platforms on datafabric_demo
4 - Dev
6 - Test
7 - Prod

datafabric_demo > platform connect 4
datafabric_demo | Dev > 
```

* job (alias: j)
```sh
datafabric_demo | Dev > job list

Available jobs on Dev
13891 - test bidule - SUCCESS
13898 - test bizarre - NEVER_RUN
13906 - Demo_plugin - SUCCESS
13918 - Job qui tue - FAILED

datafabric_demo | Dev > job list | grep SUCCESS
13891 - test bidule - SUCCESS
13906 - Demo_plugin - SUCCESS

datafabric_demo | Dev > job info <id>
```


## TODO

* Group jobs by type
* Sort job list by name, by any other field
