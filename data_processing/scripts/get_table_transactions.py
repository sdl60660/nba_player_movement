import json
import requests
from bs4 import BeautifulSoup


base_url = "https://www.prosportstransactions.com/basketball/Search/SearchResults.php?BeginDate=2020-10-11&PlayerMovementChkBx=yes"
r = requests.get(base_url)
soup = BeautifulSoup(r.text, 'html.parser')
num_pages = int(soup.find_all("p", attrs={"class": "bodyCopy"})[-2].find_all("a")[-1].text)
print(num_pages)

transactions = []

for page_num in range(0, num_pages):
    url = base_url + f"&start={page_num*25}"
    r = requests.get(url)
    soup = BeautifulSoup(r.text, "html.parser")

    table = soup.find("table", attrs={"class": "datatable"})
    rows = table.find_all("tr", class_=lambda x: not x)
    for row in rows:
        row_data = [x.text for x in row.find_all("td")]

        # Filter out coaching/personel changes
        if ('general manager' in row_data[4].lower() 
        or 'ownership' in row_data[4].lower() 
        or 'hired' in row_data[4].lower() 
        or 'fired' in row_data[4].lower() 
        or 'coach' in row_data[4].lower() 
        or 'promoted' in row_data[4].lower()
        or '2020 NBA draft' in row_data[4]):
            continue
            
        # Correcting a mis-dated Blake Griffin transaction
        if row_data[4].strip() == "signed free agent to a 1-year (remainder of the season) $1.23M contract":
            transaction_date = "2021-03-08"
        else:
            transaction_date = row_data[0]

        transactions.append({
            "date": transaction_date,
            "team": row_data[1],
            "acquired": [x.strip() for x in row_data[2].split("• ") if x.strip() != ""],
            "relinquished": [x.strip() for x in row_data[3].split("• ") if x.strip() != ""],
            "notes": row_data[4].strip()
        })


with open('../data/supplementary_transaction_data.json', 'w') as f:
    json.dump(transactions, f)