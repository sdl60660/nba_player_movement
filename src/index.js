import React from 'react';
import ReactDOM from 'react-dom';

import "intersection-observer";
import scrollama from "scrollama";

import './index.css';
import reportWebVitals from './reportWebVitals';

import PlayerMapWrapper from './components/PlayerMapWrapper';
import { json, csv } from 'd3-fetch';

// instantiate the scrollama
const scroller = scrollama();
scroller
  .setup({
    step: ".step",
    offset: 0.6
  })

// let isMobile = window.matchMedia('(max-width: 700px)').matches;

// setup resize event
window.addEventListener("resize", scroller.resize);

// Begin loading datafiles
const promises = [
  json("data/us_states.json"),
  csv("data/team_data.csv"),
  csv("data/players.csv")
];


Promise.all(promises).then((allData) => {
    const geoData = allData[0];
    const teamData = allData[1];
    const playerData = allData[2];

    ReactDOM.render(<PlayerMapWrapper
                      id={"viz-tile"}
                      _geoData={geoData}
                      _teamData={teamData}
                      _playerData={playerData}
                      scroller={scroller}
                    />,
                    document.getElementById('viz-column'));
    });


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
