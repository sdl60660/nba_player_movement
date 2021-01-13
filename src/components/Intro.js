import React from 'react';


const Intro = (props) => {
    return (
        <div className={"intro-container"}>
            <div className={"intro-container__row"} id={"title-row"}>
                <h1 className="intro-container__title">2020-21 NBA Player Movement Map</h1>
            </div>
            <div className={"intro-container__row"}>
                <p>
                    The map below shows the state of the NBA at the beginning of the 2020 offseason. 
                    Scroll down to watch the trades, signings, waivers, and claims that have unfolded since.
                </p>
            </div>
        </div>
    )
}

export { Intro as default }