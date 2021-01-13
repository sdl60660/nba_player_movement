import React from 'react';
import ReactDOM from 'react-dom';

import "intersection-observer";

import './index.css';
import reportWebVitals from './reportWebVitals';
import { groupBy } from 'lodash';

import PlayerMapWrapper from './components/PlayerMapWrapper';
import { json, csv } from 'd3-fetch';

// setup resize event
// window.addEventListener("resize", scroller.resize);

// Begin loading datafiles
const promises = [
  json("data/us_states.json"),
  csv("data/team_data.csv"),
  csv("data/players_start.csv"),
  json("data/transactions.json")
];


Promise.all(promises).then((allData) => {
    const geoData = allData[0];
    const teamData = allData[1];
    let playerData = allData[2];
    let transactionData = groupBy(allData[3], d => d.date);
    console.log(Object.keys(transactionData)[0]);
    

    playerData.forEach(player => {
      player["2021_salary"] = +player["2021_salary"];
      player["2020_salary"] = +player["2020_salary"];

      player.salary = player["2021_salary"] ||  player["2020_salary"];
    });

    playerData = playerData.filter(x => x.salary !== undefined);
    playerData = playerData.map((player) => ({ 
      // weight: this.weightScale(player[this.attribute]),
      player_name: player.player,
      player_id: player.player_id,
      team: teamData.find((team) => team.team_id === player.team_id),
      per: +player['2020_per'],
      salary: player.salary,
      vorp: +player['2020_vorp']
    }));

    console.log(playerData)

    ReactDOM.render(
          <PlayerMapWrapper
            id={"viz-tile"}
            _geoData={geoData}
            _teamData={teamData}
            _playerData={playerData}
            transactionData={transactionData}
          />,
      document.getElementById('content'));
    });

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
