import csv
import requests
from bs4 import BeautifulSoup
import unidecode

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

from collections import Counter


with open('../data/players.csv', 'r', encoding='utf-8-sig') as f:
    player_dict = { x['player_id']: x for x in csv.DictReader(f) }

with open('../data/team_data.csv', 'r', encoding='utf-8-sig') as f:
    teams = [x for x in csv.DictReader(f)]


chrome_options = webdriver.ChromeOptions()

chrome_options.add_argument("enable-automation")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument('--headless')

driver = webdriver.Chrome(options=chrome_options)
driver.implicitly_wait(20)

for player_id, player in player_dict.items():
    player_dict[player_id]['team_id'] = 'FA'

option_contracts = []
for team in teams:
    team_id = team['team_id']

    driver.get(f"http://web.archive.org/web/20201004080457/https://www.basketball-reference.com/contracts/{team_id}.html")
    soup = BeautifulSoup(driver.page_source, 'html.parser')

    salary_table = soup.find("table", attrs={"id": "contracts"}).find("tbody")
    rows = salary_table.find_all("tr", class_=lambda x: not x)
    for row in rows:
        player_id = row.find("th")['csk']
        
        try:
            y2_salary = row.find_all("td")[2]
            player_dict[player_id]['2021_salary'] = y2_salary['csk']
            player_dict[player_id]['team_id'] = team_id

            if 'salary-pl' in y2_salary['class'] or 'salary-tm' in y2_salary['class']:
                option_contracts.append(player_id)

        except KeyError:
            pass

print(option_contracts)

driver.quit()

# 2019-20 Retirements
r = requests.get('https://www.basketball-reference.com/leagues/NBA_2020_transactions.html')
soup = BeautifulSoup(r.text, 'html.parser')
content = soup.find("div", attrs={"id": "content"}).find("ul", attrs={"class": "page_index"})

transaction_dates = content.find_all("li")
for date in transaction_dates:
    transactions = date.find_all("p")
    
    for transaction in transactions:
        transaction_text = transaction.text
        
        if 'retirement' in transaction_text:
            player_id = transaction.find('a')['href'].split('/')[-1].strip('.html')
            
            if player_id in player_dict.keys():
                player_dict[player_id]['team_id'] = 'RET'


with open('../data/players_start.csv', 'w') as f:
    out_data = list(player_dict.values())

    out_csv = csv.DictWriter(f, fieldnames=list(out_data[0].keys()))
    out_csv.writeheader()
    for row in out_data:
        out_csv.writerow(row)
