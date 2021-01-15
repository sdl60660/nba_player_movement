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
  playerData = playerData.map((player) => ({ 
    player_name: player.player,
    player_id: player.player_id,
    team: teamData.find((team) => team.team_id === player.team_id),
    position: player.position,
    per: player['2020_per'] === "" ? "-" : +player['2020_per'],
    salary: player.salary === 0 ? 1 : player.salary,
    start_salary: player.salary === 0 ? 1 : player.salary,
    end_salary: player["2021_salary"] === 0 ? 1 : player["2021_salary"],
    vorp: player['2020_vorp'] === "" ? "-" : +player['2020_vorp']
  }));

  // console.log(playerData.filter(d => d.player_id === "vonleno01"))
  
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