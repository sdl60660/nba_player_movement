import React from 'react';
import moment from 'moment';
import TransactionListing from './TransactionListing';
import PlayerMapContext from '../context/playerMapContext';



let isMobile = window.matchMedia ? window.matchMedia('(max-width: 1100px)').matches : false;

const TransactionCard = ({ transactionDate, transactions, className }) => {
    const formattedDate = isMobile ? moment(transactionDate).format('ll') : moment(transactionDate).format('LL')

    return (
        <div className={className}>
            <div className={"transaction-card__visible-section"}>
                <div className={"transaction-card__date-header"}>{formattedDate}</div>
                <ul className={"transaction-card__transaction-list"}>
                    { transactions.map((transaction, i) => 
                        <TransactionListing transaction={transaction} key={i} />
                    ) }
                </ul>
            </div>
        </div>
    )
}

export { TransactionCard as default }