import React from 'react';
import moment from 'moment';


let isMobile = window.matchMedia ? window.matchMedia('(max-width: 950px)').matches : false;

const TransactionCard = ({ transactionDate, transactions, className }) => {
    const formattedDate = isMobile ? moment(transactionDate).format('ll') : moment(transactionDate).format('LL')

    return (
        <div className={className}>
            <div className={"transaction-card__visible-section"}>
                <div className={"transaction-card__date-header"}>{formattedDate}</div>
                <ul className={"transaction-card__transaction-list"}>
                    { transactions.map((transaction, i) => {
                        const classList = transaction.players.map((player) => `transaction-log-${player.player_id}`).join(' ')
                        
                        return (
                            <li
                                className={`transaction-card__transaction-item ${classList}`}
                                key={i}>{ transaction.text }
                            </li>
                            )
                        }) 
                    }
                </ul>
            </div>
        </div>
    )
}

export { TransactionCard as default }