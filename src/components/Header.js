import React from 'react';


const Header = () => {
    return (
        <div className={"header"}>
            <div className={"header__main-site-link"}>
                <a href="https://bit.ly/main-project-site">
                    <button>More Projects</button>
                </a>
            </div>
        </div>
    )
}

export { Header as default }