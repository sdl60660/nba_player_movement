import React from 'react';


const Footer = ({ githubLink = "" }) => {
    return (
        <div className={"footer"}>
        <hr />
            <div className="footer__section">
                <p><strong>Visualization by <a target="_blank" href="https://www.samlearner.com">Sam Learner</a></strong> |&nbsp;
                    <a target="_blank" href="mailto:learnersd@gmail.com"><img className="icon-img" src="/images/email.svg" /></a> |&nbsp;
                    <a target="_blank" href="https://twitter.com/sam_learner"><img className="icon-img" src="/images/twitter.svg" /></a> |&nbsp;
                    <a target="_blank" href="https://github.com/sdl60660"><img className="icon-img" src="/images/github.png" /></a>
                </p>
                <p>Code and data for this project lives <a target="_blank" href={githubLink}>here</a>.</p> 
            </div>

            <div className="footer__section">
                <p><strong>Sources</strong></p>
                <p>
                    All transaction data comes from <a href="https://www.basketball-reference.com/leagues/NBA_2021_transactions.html">Basketball Reference</a>&nbsp;
                    and <a href="https://www.prosportstransactions.com/basketball/Search/SearchResults.php?Player=&Team=&BeginDate=2020-10-11&EndDate=&PlayerMovementChkBx=yes&Submit=Search">Pro Sports Transactions</a>.&nbsp;
                    Player stats and contract data came from Basketball Reference. Player photos came from <a href="https://www.2kratings.com/">2KRatings.com</a>. Phone rotation icon by Kelig Le Luron from the Noun Project.
                </p>
            </div>
            
            <div className="footer__section">
                <p><strong>Notes</strong></p>
                <p>
                    Exhibit 10 and two-way contracts were not included in the listed transactions to avoid some salary complexity. It is possible that there 
                    are inaccuracies in the underlying transaction data (I've found and manually corrected a few missing or inaccurate transactions, so I know that the data&nbsp;
                    from Basketball Reference isn't perfect). Advanced Stats (BPM variants, VORP) are minutes-qualified.
                </p>
            </div>

            <p>Last Updated: March 26, 2021</p>
        </div>
    )
}

export { Footer as default }