import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment';


let isMobile = window.matchMedia('(max-width: 900px)').matches;

const TransactionCard = ({ transactionDate, transactions, className }) => {
    const formattedDate = isMobile ? moment(transactionDate).format('ll') : moment(transactionDate).format('LL')

    return (
        <div className={className}>
            <div className={"transaction-card__date-header"}>{formattedDate}</div>
            <ul className={"transaction-card__transaction-list"}>
                { transactions.map((transaction, i) => <li
                                                        className={"transaction-card__transaction-item"}
                                                        key={i}>{ transaction.text }
                                                        </li> ) 
                                                    }
            </ul>
        </div>
    )
}

export { TransactionCard as default }