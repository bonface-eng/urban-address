import os
import re
import csv
from pypdf import PdfReader

LOUNGE_PDF = r"C:\Users\Gackstone_Baraka\.gemini\antigravity\brain\7147dcef-4f8e-4332-a7e6-0551ddd8a207\.user_uploaded\media_1795813332257_d2845d6a.pdf"
STORE_PDF = r"C:\Users\Gackstone_Baraka\.gemini\antigravity\brain\7147dcef-4f8e-4332-a7e6-0551ddd8a207\.user_uploaded\media_1795813332257_68130de8.pdf"

OUTPUT_DIR = r"c:\Users\Gackstone_Baraka\Downloads\urban-address-main\migration-output\inventory"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Common typo mappings
TYPO_REPLACEMENTS = [
    (r"\bJAGGMISTER\b", "JAGERMEISTER"),
    (r"\bJAGGER MEISTER\b", "JAGERMEISTER"),
    (r"\bJÄGERMEISTER\b", "JAGERMEISTER"),
    (r"\bDAHBOARD\b", "DASHBOARD"),
    (r"\bDASHBOAD\b", "DASHBOARD"),
    (r"\bFOUTH\b", "FOURTH"),
    (r"\bS0DA\b", "SODA"),
    (r"\bCOFEE\b", "COFFEE"),
    (r"\bHOLF\b", "HOF"),
    (r"\bHENNESSEY\b", "HENNESSY"),
    (r"\bTANQUERY\b", "TANQUERAY"),
    (r"\bSMINORFF\b", "SMIRNOFF"),
    (r"\bGILBEYS\b", "GILBEY'S"),
    (r"\bDUBHILL\b", "DUNHILL"),
    (r"\bDECREASER\b", "DEGREASER"),
    (r"\bINSURENCE\b", "INSURANCE"),
    (r"\bWIPPERS\b", "WIPERS"),
    (r"\bPOILSH\b", "POLISH"),
    (r"\bABSOBER\b", "ABSORBER"),
    (r"\bJOSE CUEVO\b", "JOSE CUERVO"),
    (r"\bJOSE QUAVO\b", "JOSE CUERVO"),
    (r"\bDOOR GURD\b", "DOOR GUARD"),
    (r"\bCOCKPIT SHINER AND PROCTETOR\b", "COCKPIT SHINER AND PROTECTOR"),
    (r"\bWINDSHIELD WAHSER\b", "WINDSHIELD WASHER"),
    (r"\bLEMON FREASH\b", "LEMON FRESH"),
    (r"\bAIR FRESHNER\b", "AIR FRESHENER"),
    (r"\bAIRFRESHENER\b", "AIR FRESHENER"),
]

def to_title_case(name: str) -> str:
    # Preserve acronyms and specific capitalization
    special = {
        "750ml": "750ml", "1l": "1L", "350ml": "350ml", "330ml": "330ml", "500ml": "500ml", "250ml": "250ml",
        "1kg": "1kg", "1/2kg": "1/2kg", "1/4kg": "1/4kg", "tot": "Tot", "pos": "POS", "can": "Can", "btl": "Btl",
        "hq": "HQ", "vsop": "VSOP", "xo": "XO", "led": "LED", "usb": "USB", "kg": "kg", "ml": "ml",
        "dr": "Dr.", "dr.": "Dr.", "gladiator": "Gladiator", "chamois": "Chamois"
    }
    words = name.split()
    title_words = []
    for w in words:
        wl = w.lower()
        if wl in special:
            title_words.append(special[wl])
        elif re.match(r"^\d+(ml|l|kg|g|mm)$", wl):
            title_words.append(wl.upper())
        else:
            title_words.append(w.capitalize())
    return " ".join(title_words)

def extract_size(name: str):
    # Match patterns like 750ML, 750 ML, 1L, 1 LITRE, 350ML, 500ML, 1KG, 1/2KG, 1/4KG, TOT
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(ML|LITRE|LITER|L|KG|G|MM)\b", name, re.IGNORECASE)
    if m:
        val = m.group(1)
        unit = m.group(2).upper()
        if unit in ["LITRE", "LITER"]:
            unit = "L"
        return f"{val} {unit}", unit
    m_frac = re.search(r"\b(1/2|1/4|3/4)\s*(KG|G)?\b", name, re.IGNORECASE)
    if m_frac:
        val = m_frac.group(1)
        unit = (m_frac.group(2) or "KG").upper()
        return f"{val} {unit}", unit
    if re.search(r"\bTOT\b", name, re.IGNORECASE):
        return "TOT", "TOT"
    if re.search(r"\bGLASS\b", name, re.IGNORECASE):
        return "GLASS", "GLASS"
    return None, None

def infer_subcategory(name: str, cat: str, unit: str) -> str:
    name_u = name.upper()
    if unit == "LOUNGE":
        if cat == "TOBACCO":
            return "Tobacco & Vapes"
        if cat == "FOOD":
            if any(k in name_u for k in ["CHIPS", "SAMOSA", "SAUSAGE", "BURGER", "SANDWICH", "WINGS", "NUGGETS", "EGG"]):
                return "Fast Food / Bites"
            return "Main Meals"
        # DRINKS:
        if any(k in name_u for k in ["TUSKER", "GUINNESS", "HEINEKEN", "WHITE CAP", "BAVARIA", "CORONA", "PILSNER", "BALOZI", "BUDWEISER", "STELLA", "DESPERADOS", "SAVANNA", "HUNTERS", "SMIRNOFF ICE", "BLACK ICE"]):
            return "Beers & Ciders"
        if any(k in name_u for k in ["JOHNNIE WALKER", "BLACK LABEL", "RED LABEL", "JACK DANIEL", "JAMESON", "GLENFIDDICH", "GLENLIVET", "CHIVAS", "SINGLETON", "MONKEY SHOULDER", "VAT 69", "BALLANTINE", "FAMOUS GROUSE", "GRANTS", "J&B", "MACALLAN", "WILLIAM LAWSON", "BOND 7", "BLACK & WHITE", "RICHOT"]):
            return "Whisky"
        if any(k in name_u for k in ["GIN", "BOMBAY", "TANQUERAY", "HENDRICK", "GORDON", "GILBEY", "BEEFEATER", "CHROME"]):
            return "Gin"
        if any(k in name_u for k in ["VODKA", "SMIRNOFF", "ABSOLUT", "CIROC", "GREY GOOSE", "KETEL ONE", "FLIRT"]):
            return "Vodka"
        if any(k in name_u for k in ["CAPTAIN MORGAN", "BACARDI", "BUMBU", "HAVANA", "MALIBU", "RUM", "CARTA BLANCA"]):
            return "Rum"
        if any(k in name_u for k in ["TEQUILA", "DON JULIO", "CAMINO", "JOSE CUERVO", "OLMECA", "PATRON"]):
            return "Tequila"
        if any(k in name_u for k in ["HENNESSY", "REMY MARTIN", "MARTELL", "COURVOISIER", "VICEROY", "BRANDY"]):
            return "Cognac & Brandy"
        if any(k in name_u for k in ["WINE", "FOURTH STREET", "DROSTDY", "FRONTERA", "CASILLERO", "NEDERBURG", "ASCONI", "ROBERTSON", "BELLA", "CHAMDOR"]):
            return "Wine"
        if any(k in name_u for k in ["JAGERMEISTER", "BAILEYS", "AMARULA", "KAHLUA", "CAMPARI", "APEROL", "JAGGMISTER"]):
            return "Liqueur"
        if any(k in name_u for k in ["SODA", "WATER", "COKE", "FANTA", "SPRITE", "STONEY", "KESTREL", "TONIC", "GINGER ALE", "DASANI", "KERINGET"]):
            return "Soft Drinks & Water"
        if any(k in name_u for k in ["RED BULL", "MONSTER", "POWER PLAY"]):
            return "Energy Drinks"
        if any(k in name_u for k in ["COFFEE", "TEA", "CHOCOLATE", "CAPPUCCINO", "LATTE", "ESPRESSO"]):
            return "Hot Beverages"
        if any(k in name_u for k in ["COSMOPOLITAN", "MOJITO", "LONG ISLAND", "DAIQUIRI", "MARGARITA", "COCKTAIL"]):
            return "Cocktails"
        return "Beverages"
    else: # STORE
        if cat == "TYRES":
            return "Tyres"
        if cat == "PARTS":
            return "Parts"
        if cat == "DRINKS":
            return "Cocktails / Drinks-in-Store"
        if any(k in name_u for k in ["POLISH", "SHAMPOO", "WAX", "CLEANER", "DEGREASER", "RESTORE", "WASH", "TYRE SHINE"]):
            return "Car Care & Cleaning"
        if any(k in name_u for k in ["WIPER", "MAT", "COVER", "HOLDER", "LIGHT", "BULB", "KEYBOARD", "PERFUME", "AIR FRESHENER"]):
            return "Accessories"
        return "Store Merchandise"

def process_all():
    lounge_reader = PdfReader(LOUNGE_PDF)
    store_reader = PdfReader(STORE_PDF)
    
    # 1. PARSE LOUNGE
    LOUNGE_KNOWN_CATS = ["DRINKS", "FOOD", "TOBACCO", "OTHER"]
    raw_lounge = []
    for page in lounge_reader.pages:
        for line in page.extract_text().split("\n"):
            line = line.strip()
            m = re.match(r"^(\d+)\s+(.*)$", line)
            if m:
                sn = int(m.group(1))
                rest = m.group(2).strip()
                matched_cat = None
                for cat in LOUNGE_KNOWN_CATS:
                    if rest.endswith(cat):
                        matched_cat = cat
                        pname = rest[:-len(cat)].strip()
                        break
                if not matched_cat:
                    pname = rest
                raw_lounge.append({"sn": sn, "original_name": pname, "raw_cat": matched_cat, "raw_line": rest})
                
    # 2. PARSE STORE
    STORE_KNOWN_CATS = ["CLEANING", "ACCESSORIES", "PARTS", "TYRES", "DRINKS", "FOOD"]
    raw_store = []
    for page in store_reader.pages:
        for line in page.extract_text().split("\n"):
            line = line.strip()
            m = re.match(r"^(\d+)\s+(.*)$", line)
            if m:
                sn = int(m.group(1))
                rest = m.group(2).strip()
                # Store line ends with quantity digits
                m_qty = re.search(r"(\d+)$", rest)
                if m_qty:
                    qty = int(m_qty.group(1))
                    before_qty = rest[:m_qty.start()].strip()
                else:
                    qty = None
                    before_qty = rest
                matched_cat = None
                for cat in STORE_KNOWN_CATS:
                    if before_qty.endswith(cat):
                        matched_cat = cat
                        pname = before_qty[:-len(cat)].strip()
                        break
                if not matched_cat:
                    pname = before_qty
                raw_store.append({"sn": sn, "original_name": pname, "raw_cat": matched_cat, "qty": qty, "raw_line": rest})

    print(f"Parsed Lounge rows: {len(raw_lounge)}")
    print(f"Parsed Store rows: {len(raw_store)}")
    
    records = []
    
    # PROCESS LOUNGE
    for item in raw_lounge:
        sn = item["sn"]
        orig = item["original_name"]
        raw_cat = item["raw_cat"]
        unit = "LOUNGE"
        stock_qty = None # NEVER INVENT LOUNGE STOCK
        price = None # NEVER INVENT PRICE
        
        # Check exclusion: Lounge S/N 292 is "TESTING"
        if sn == 292 or orig.upper() == "TESTING":
            records.append({
                "source_sheet": "LOUNGE", "source_sn": sn, "original_name": orig, "cleaned_name": orig,
                "unit": unit, "category": "EXCLUDED", "subcategory": "EXCLUDED", "size": None,
                "stock_quantity": None, "price": None, "action_taken": "EXCLUDED (Test row)",
                "needs_review": False, "review_notes": "Excluded test row as instructed", "is_excluded": True
            })
            continue

        # Clean typos
        cleaned = orig
        for pattern, repl in TYPO_REPLACEMENTS:
            cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
        
        # Truncated names check
        truncated = False
        if cleaned.endswith("..."):
            cleaned = cleaned[:-3].strip()
            truncated = True
        elif cleaned.endswith(".."):
            cleaned = cleaned[:-2].strip()
            truncated = True
            
        if sn == 273 and orig.upper() == 'WHITE COFEE':
            display_name = 'White Cofee'
            needs_review = True
            notes.append('Near-duplicate of S/N 274 White Coffee; kept separate for review')
        else:
            display_name = to_title_case(cleaned)
        
        # Category resolution
        cat = raw_cat
        needs_review = False
        notes = []
        
        if not cat:
            if "COFFEE" in orig.upper():
                cat = "FOOD" # Or DRINKS
                notes.append("Inferred category FOOD (Hot Beverages)")
                needs_review = True
            elif "TOT" in orig.upper():
                cat = "DRINKS"
                notes.append("Inferred category DRINKS")
                needs_review = True
            elif any(k in orig.upper() for k in ["TIN", "GLASS"]):
                cat = "OTHER"
                notes.append("POS charge / non-stock item")
                needs_review = True
            else:
                cat = "OTHER"
                notes.append("Missing category in source")
                needs_review = True
                
        # Non-stock items
        track_stock = True
        if orig.upper() in ["TAKE AWAY TIN", "TAKE AWAY (TIN)", "WINE GLASS"]:
            track_stock = False
            needs_review = True
            notes.append("Non-stock / POS charge item (track_stock=false)")
            
        if truncated:
            needs_review = True
            notes.append("Name truncated in source PDF (...)")
            
        size_str, size_unit = extract_size(cleaned)
        subcat = infer_subcategory(cleaned, cat, unit)
        
        action = "CLEANED"
        if orig != cleaned:
            action = "TYPO_FIXED"
            notes.append(f"Fixed typos from '{orig}' to '{cleaned}'")
            
        records.append({
            "source_sheet": "LOUNGE", "source_sn": sn, "original_name": orig, "cleaned_name": display_name,
            "unit": unit, "category": cat, "subcategory": subcat, "size": size_str,
            "stock_quantity": stock_qty, "price": price, "action_taken": action,
            "needs_review": needs_review, "review_notes": "; ".join(notes),
            "track_stock": track_stock, "is_excluded": False
        })
        
    # PROCESS STORE
    for item in raw_store:
        sn = item["sn"]
        orig = item["original_name"]
        raw_cat = item["raw_cat"]
        unit = "STORE"
        stock_qty = item["qty"] # KEEP STORE QUANTITY
        price = None # NEVER INVENT PRICE
        
        # Check exclusion: Store S/N 137 is "TESTING 98"
        if sn == 137 or orig.upper() == "TESTING":
            records.append({
                "source_sheet": "STORE", "source_sn": sn, "original_name": orig, "cleaned_name": orig,
                "unit": unit, "category": "EXCLUDED", "subcategory": "EXCLUDED", "size": None,
                "stock_quantity": stock_qty, "price": None, "action_taken": "EXCLUDED (Test row)",
                "needs_review": False, "review_notes": f"Excluded test row with quantity {stock_qty}", "is_excluded": True
            })
            continue

        # Clean typos
        cleaned = orig
        for pattern, repl in TYPO_REPLACEMENTS:
            cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
            
        truncated = False
        if cleaned.endswith("..."):
            cleaned = cleaned[:-3].strip()
            truncated = True
        elif cleaned.endswith(".."):
            cleaned = cleaned[:-2].strip()
            truncated = True
            
        display_name = to_title_case(cleaned)
        
        cat = raw_cat
        needs_review = False
        notes = []
        
        # Check drinks/food in store
        if any(k in orig.upper() for k in ["BLACK & WHITE", "SAUSAGE", "SODA", "DASANI", "COSMOPOLITAN", "LONG ISLAND", "URBAN 26", "MIX GO", "AFIA"]):
            notes.append("Drinks/food kept in STORE unit as printed")
            needs_review = True
            if not cat:
                cat = "DRINKS"
                
        if not cat:
            orig_u = orig.upper()
            if any(k in orig_u for k in ["POLISH", "SHAMPOO", "WAX", "CLEANER", "DEGREASER", "WASH", "TYRE SHINE", "RESTORE"]):
                cat = "CLEANING"
                notes.append("Inferred category CLEANING")
                needs_review = True
            elif any(k in orig_u for k in ["WIPER", "MAT", "ABSORBER", "HOLDER", "FRESHENER", "KEYBOARD", "GUARD", "LIGHT"]):
                cat = "ACCESSORIES"
                notes.append("Inferred category ACCESSORIES")
                needs_review = True
            elif any(k in orig_u for k in ["TYRE"]):
                cat = "TYRES"
                notes.append("Inferred category TYRES")
                needs_review = True
            elif any(k in orig_u for k in ["BRAKE", "PAD", "FILTER", "PLUG", "BELT", "BEARING"]):
                cat = "PARTS"
                notes.append("Inferred category PARTS")
                needs_review = True
            else:
                cat = "ACCESSORIES"
                notes.append("Defaulted missing category to ACCESSORIES")
                needs_review = True
                
        if truncated:
            needs_review = True
            notes.append("Name truncated in source PDF (...)")
            
        size_str, size_unit = extract_size(cleaned)
        subcat = infer_subcategory(cleaned, cat, unit)
        
        action = "CLEANED"
        if orig != cleaned:
            action = "TYPO_FIXED"
            notes.append(f"Fixed typos from '{orig}' to '{cleaned}'")
            
        records.append({
            "source_sheet": "STORE", "source_sn": sn, "original_name": orig, "cleaned_name": display_name,
            "unit": unit, "category": cat, "subcategory": subcat, "size": size_str,
            "stock_quantity": stock_qty, "price": price, "action_taken": action,
            "needs_review": needs_review, "review_notes": "; ".join(notes),
            "track_stock": True, "is_excluded": False
        })
        
    # 3. DEDUPLICATION (Lounge duplicates & Store duplicates)
    # Lounge exact duplicates:
    # S/N 205 & 215: SAMOSA
    # S/N 206 & 216: SAMOSA SPECIAL
    # S/N 207 & 217: SAUSAGE
    # S/N 196 & 288: RICHOT 750ML
    # Store duplicates:
    # S/N 2 & 14: BLACK & WHITE 750ML (qty 2 + 3 = 5)
    # S/N 29 & 30: COSMOPOLITAN (qty 10 + 4 = 14)
    # S/N 84 & 85: FLOOR MAT (qty 2 + 12 = 14)
    
    # Mark duplicates in records
    lounge_dup_pairs = [(205, 215), (206, 216), (207, 217), (196, 288)]
    store_dup_pairs = [(2, 14), (29, 30), (84, 85)]
    
    # Store merged items
    for rec in records:
        if rec["source_sheet"] == "LOUNGE":
            for primary_sn, dup_sn in lounge_dup_pairs:
                if rec["source_sn"] == dup_sn:
                    rec["action_taken"] = f"MERGED into S/N {primary_sn}"
                    rec["is_merged_duplicate"] = True
                    rec["review_notes"] += f"; Duplicate of S/N {primary_sn}, merged"
                elif rec["source_sn"] == primary_sn:
                    rec["review_notes"] += f"; Has duplicate at S/N {dup_sn} (merged)"
        elif rec["source_sheet"] == "STORE":
            for primary_sn, dup_sn in store_dup_pairs:
                if rec["source_sn"] == dup_sn:
                    rec["action_taken"] = f"MERGED into S/N {primary_sn}"
                    rec["is_merged_duplicate"] = True
                    rec["review_notes"] += f"; Duplicate of S/N {primary_sn}, merged quantities"
                elif rec["source_sn"] == primary_sn:
                    # find dup qty
                    dup_rec = next(r for r in records if r["source_sheet"] == "STORE" and r["source_sn"] == dup_sn)
                    orig_qty = rec["stock_quantity"]
                    rec["stock_quantity"] = (orig_qty or 0) + (dup_rec["stock_quantity"] or 0)
                    rec["review_notes"] += f"; Merged with S/N {dup_sn} (qty {orig_qty} + {dup_rec['stock_quantity']} = {rec['stock_quantity']})"

    # Write CLEANING_REPORT.csv
    csv_path = os.path.join(OUTPUT_DIR, "CLEANING_REPORT.csv")
    fields = [
        "source_sheet", "source_sn", "original_name", "cleaned_name", "unit",
        "category", "subcategory", "size", "stock_quantity", "price",
        "action_taken", "needs_review", "review_notes"
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in records:
            writer.writerow({k: r.get(k, "") for k in fields})
            
    print(f"Generated CLEANING_REPORT.csv with {len(records)} entries at: {csv_path}")
    
    # Prepare active records to insert into DB
    db_records = [r for r in records if not r.get("is_excluded") and not r.get("is_merged_duplicate")]
    print(f"Total records to insert into DB: {len(db_records)}")
    lounge_db = [r for r in db_records if r["unit"] == "LOUNGE"]
    store_db = [r for r in db_records if r["unit"] == "STORE"]
    print(f"Active Lounge: {len(lounge_db)} (295 original - 1 excluded - 4 merged dups = 290)")
    print(f"Active Store: {len(store_db)} (154 original - 1 excluded - 3 merged dups = 150)")

process_all()
