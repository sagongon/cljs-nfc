import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = '1iQNsYbU3hpmKiXOAqo1C5wuj03zABQgS_G07waf2Cis'
RANGE_ATTEMPTS = 'Atempts!B2:BA'
RANGE_ASSIST = 'Assist Tables!B1:BA2'
RANGE_SCORE = 'Score!B2:BA'
RANGE_RANK = 'ScoreRankTable!B2:G'

CREDENTIALS_FILE = 'credentials.json'

# התחברות לשירות
creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)

def get_sheet_values(range_name):
    sheet = service.spreadsheets()
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=range_name).execute()
    return result.get('values', [])

# שליפת נתונים
attempts_data = get_sheet_values(RANGE_ATTEMPTS)
assist_data = get_sheet_values(RANGE_ASSIST)
rank_table = get_sheet_values(RANGE_RANK)

# קריאת ניקוד מקסימלי ממסלולים
route_scores = assist_data[1]  # שורה שנייה = ניקוד
score_data = []

for i, row in enumerate(attempts_data):
    name = row[0] if len(row) > 0 else ''
    scores = []
    for j in range(1, min(len(row), len(route_scores)+1)):
        try:
            attempts = int(row[j])
            full_score = int(route_scores[j-1])
            score = max(full_score - 10 * (attempts - 1), 0)
            scores.append(score)
        except:
            scores.append(0)
    score_data.append([name] + scores)

# כתיבת ניקוד לגיליון Score
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range=RANGE_SCORE,
    valueInputOption='USER_ENTERED',
    body={'values': score_data}
).execute()

# חישוב דירוג לפי 7 התוצאות הכי גבוהות
rank_results = []
for row in score_data:
    name = row[0]
    scores = sorted(row[1:], reverse=True)[:7]
    total = sum(scores)
    rank_results.append((name, total))

# שליפת קטגוריה ומועדון לפי שם מהטבלה
id_lookup = {row[0]: row for row in rank_table if len(row) >= 6}
final_table = []
for name, total in rank_results:
    row = id_lookup.get(name)
    if row:
        club = row[1]
        category = row[3]
        final_table.append([name, club, category, total])

# מיון לפי קטגוריה ואז ניקוד
final_table.sort(key=lambda x: (x[2], -x[3]))

# הדפסה לבדיקה
for row in final_table:
    print(f"{row[2]} | {row[0]} | {row[1]} | {row[3]}")
