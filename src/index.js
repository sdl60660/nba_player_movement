// @flow

// React
import React from 'react';
import ReactDOM from 'react-dom';

// Styles
import './styles/styles.scss';

// CRA
import "intersection-observer";
import reportWebVitals from './reportWebVitals';

// Outside libraries
import { json, csv } from 'd3-fetch';
import { groupBy } from 'lodash';
import * as d3 from 'd3';


// Components
import PlayerMapWrapper from './components/PlayerMapWrapper';
import Header from './components/Header';
import Loader from './components/Loader';
import Intro from './components/Intro';
import Footer from './components/Footer';


const formatTeamData = (teamData) => {
  teamData.forEach((team) => {
    team.color_1 = d3.color(team.color_1);
    team.color_2 = d3.color(team.color_2);
  })

  return teamData;
}

const formatPlayerData = (playerData, teamData) => {
  playerData.forEach(player => {
    player["2021_preseason_salary"] = +player["2021_preseason_salary"];
    player["2021_salary"] = +player["2021_salary"];
    player["2020_salary"] = +player["2020_salary"];

    player.salary = player["2021_preseason_salary"];
  });

  playerData = playerData.filter(x => x.salary !== undefined);
  playerData = playerData.map((player) => { 

    let playerDict = {
      player_name: player.player,
      player_id: player.player_id,
      team: teamData.find((team) => team.team_id === player.team_id),
      position: player.position,
      salary: player.salary,
      start_salary: player.salary,
      end_salary: player["2021_salary"]
    };

    ['vorp', 'bpm', 'obpm', 'dbpm', 'pts_per_g', 'trb_per_g', 'ast_per_g', 'mp_per_g', 'mp'].forEach(stat => {
      playerDict[`2020_${stat}`] = player[`2020_${stat}`] === "" ? "-" : +player[`2020_${stat}`];
      playerDict[`2021_${stat}`] = player[`2021_${stat}`] === "" ? "-" : +player[`2021_${stat}`];
    })

    return playerDict
  });
  
  return playerData;
}

// Begin loading datafiles
const promises = [
  json("data/us_states.json"),
  csv("data/team_data.csv"),
  csv("data/players_start.csv"),
  json("data/transactions.json")
];

// Render React components (and inner d3 viz) on data load
Promise.all(promises).then((allData) => {
    const geoData = allData[0];
    let teamData = formatTeamData(allData[1]);
    let playerData = formatPlayerData(allData[2], teamData);
    let transactionData = groupBy(allData[3], d => d.date);
    
    const jsx =
      <div>
        <img alt={"rotate phone prompt"} style={{opacity: 0 }} onLoad={(e) => { e.target.style.opacity = 1 }} id="rotate-prompt" src="images/phone_rotation.svg" />
        <Header />
        <Intro />
        <PlayerMapWrapper
          id={"viz-tile"}
          _geoData={geoData}
          _teamData={teamData}
          _playerData={playerData}
          transactionData={transactionData}
        />
        <Footer githubLink={"https://github.com/sdl60660/nba_player_movement"} />
      </div>

    ReactDOM.render(jsx, document.getElementById("content"));
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log);

export { formatPlayerData }