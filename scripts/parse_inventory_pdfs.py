import os
import re
from pypdf import PdfReader

LOUNGE_PDF = r"C:\Users\Gackstone_Baraka\.gemini\antigravity\brain\7147dcef-4f8e-4332-a7e6-0551ddd8a207\.user_uploaded\media_1795813332257_d2845d6a.pdf"
STORE_PDF = r"C:\Users\Gackstone_Baraka\.gemini\antigravity\brain\7147dcef-4f8e-4332-a7e6-0551ddd8a207\.user_uploaded\media_1795813332257_68130de8.pdf"

print("--- LOUNGE PDF ---")
lounge_reader = PdfReader(LOUNGE_PDF)
print(f"Lounge Pages: {len(lounge_reader.pages)}")
for i, page in enumerate(lounge_reader.pages):
    text = page.extract_text()
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    print(f"Page {i+1}: {len(lines)} lines. Sample: {lines[:5]}")

print("\n--- STORE PDF ---")
store_reader = PdfReader(STORE_PDF)
print(f"Store Pages: {len(store_reader.pages)}")
for i, page in enumerate(store_reader.pages):
    text = page.extract_text()
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    print(f"Page {i+1}: {len(lines)} lines. Sample: {lines[:5]}")
