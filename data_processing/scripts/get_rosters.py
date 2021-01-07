import csv
import requests
from bs4 import BeautifulSoup


def process_player_row(row):
    player_data = { x['data-stat']: x.text for x in row.find_all('td') }
    return player_data

player_dict = {}

r = requests.get("https://www.basketball-reference.com/leagues/NBA_2021_advanced.html")
soup = BeautifulSoup(r.text, "html.parser")
table = soup.find("table", attrs={"id": "advanced_stats"})

rows = soup.find("tbody").find_all("tr", attrs={"class": "full_table"})
for row in rows:
    player_id = row.find_all("td")[0]['data-append-csv']
    player_dict[player_id] = process_player_row(row)


with open('../data/players.csv', 'w') as f:
    out_data = list(player_dict.values())

    out_csv = csv.DictWriter(f, fieldnames=list(out_data[0].keys()))
    out_csv.writeheader()

    for row in out_data:
        out_csv.writerow(row)

