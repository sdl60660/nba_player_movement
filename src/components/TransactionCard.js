import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment';

const TransactionCard = ({ transactionDate, transactions, className }) => {
    return (
        <div className={className}>
            <span class={"transaction-card__date-header"}><strong>{moment(transactionDate).format('LL')}</strong></span>
            <ul>
                { transactions.map((transaction) => <li>{ transaction.text }</li> ) }
            </ul>
        </div>
    )
}

export { TransactionCard as default }