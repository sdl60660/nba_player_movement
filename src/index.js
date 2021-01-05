import React from 'react';
import ReactDOM from 'react-dom';

import "intersection-observer";
import scrollama from "scrollama";

import './index.css';
import reportWebVitals from './reportWebVitals';

import PlayerMapWrapper from './components/PlayerMapWrapper'
import { json } from 'd3-fetch';

// instantiate the scrollama
const scroller = scrollama();

// setup the instance, pass callback functions
scroller
  .setup({
    step: ".step",
  })
  .onStepEnter(({ element, index, direction }) => {
    console.log({ element, index, direction })
  })
  .onStepExit(({ element, index, direction }) => {
    console.log({ element, index, direction })
  });

// setup resize event
window.addEventListener("resize", scroller.resize);


// Begin loading datafiles
const promises = [
  json("data/us_states.json")
];


Promise.all(promises).then((allData) => {
    const geoData = allData[0];
    // const map = new playerMap("#map-tile", allData[0]);

    ReactDOM.render(<PlayerMapWrapper id={"viz-tile"} _geoData={geoData}/>, document.getElementById('viz-column'));
    // ReactDOM.render(<p/>, document.getElementById('root'));

});



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
