"use strict";
const fs = require('fs');

let stats = {};

class Stats {
    constructor(){

    }

    read(field){
        return stats[field];
    }

    add(field){
        stats[field] += 1;
        return this.read(field);
    }
}

module.exports = new Stats();