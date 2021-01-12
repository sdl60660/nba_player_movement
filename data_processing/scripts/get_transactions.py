import csv
import json
from datetime import datetime
import requests
from bs4 import BeautifulSoup


def process_multi_team(transaction_element):
    all_links = transaction_element.find_all("a")

    breakpoints = []
    for i, link in enumerate(all_links):
        if 'data-attr-from' in link.attrs:
            breakpoints.append(i)
    
    players = []
    for i, point in enumerate(breakpoints):
        if i == len(breakpoints)-1:
            link_chunk = all_links[point:]
        else:
            link_chunk = all_links[point:breakpoints[i+1]]
        
        players += process_trade(link_chunk)
    
    return players


def process_trade(links):
    players = []

    for i, link in enumerate(links):
        if 'data-attr-from' in link.attrs:
            from_team_id = link['data-attr-from']
            from_team_index = i
        elif 'data-attr-to' in link.attrs:
            to_team_id = link['data-attr-to']
            to_team_index = i
    
    for link in links[from_team_index+1:to_team_index]:
        player_id = link['href'].split('/')[-1].replace('.html', '')
        if player_id in player_dict.keys():
            players.append({
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": to_team_id
            })

    for link in links[to_team_index+1:]:
        player_id = link['href'].split('/')[-1].replace('.html', '')
        if player_id in player_dict.keys():
            players.append({
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": from_team_id
            })

    return players
    

transaction_types = ['signed', 'waived', 'claimed', '-team trade', 'traded']
all_transactions = []

with open('../data/players_start.csv', 'r') as f:
    player_dict = {x['player_id']: x for x in csv.DictReader(f)}

r = requests.get("https://www.basketball-reference.com/leagues/NBA_2021_transactions.html")
soup = BeautifulSoup(r.text, 'html.parser')

content = soup.find("div", attrs={"id": "content"}).find("ul", attrs={"class": "page_index"})
transaction_dates = content.find_all("li")

for date in transaction_dates[::-1]:
    date_string = date.find("span").text

    if date_string == "?":
        date_string = "November 27, 2020"

    formatted_date = datetime.strftime(datetime.strptime(date_string, "%B %d, %Y"), "%Y-%m-%d")
    print(date_string)

    transactions = date.find_all("p")
    for transaction in transactions:
        transaction_text = transaction.text

        if " hired " in transaction_text or "Exhibit 10" in transaction_text or "two-way contract" in transaction_text:
            continue
        
        for word in transaction_types:
            if word in transaction_text:
                transaction_type = word
                break
        
        player_data = []

        if transaction_type == "signed" or transaction_type == "claimed":
            player_id = transaction.find_all("a")[-1]['href'].split('/')[-1].replace('.html', '')

            # Transaction logs don't specify two-way contracts on waiver claims, so filter these and continue here
            if player_id not in player_dict.keys():
                continue

            to_team = transaction.find_all("a")[0]['href'].split('/')[2]
            player_movement = {
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": to_team,
            }
            player_data = [player_movement]

        elif transaction_type == "waived":
            player_id = transaction.find_all("a")[-1]['href'].split('/')[-1].replace('.html', '')

            # Transaction logs don't specify Exhitbit 10 contracts on waives, so filter these and continue here
            if player_id not in player_dict.keys():
                continue

            to_team = 'FA'
            player_movement = {
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": to_team,
            }
            player_data = [player_movement]

        elif transaction_type == "traded":
            links = transaction.find_all("a")
            player_data = process_trade(links)

        elif transaction_type == "-team trade":
            transaction_type = "n-team trade"
            player_data = process_multi_team(transaction)

        transaction_dict = {
            "type": transaction_type,
            "date": formatted_date,
            "players": player_data
        }

        for player in player_data:
            player_dict[player["player_id"]]["team_id"] = player["to_team"]

        all_transactions.append(transaction_dict)
        

with open('../data/transactions.json', 'w') as f:
    json.dump(all_transactions, f)

with open('../../public/data/transactions.json', 'w') as f:
    json.dump(all_transactions, f)