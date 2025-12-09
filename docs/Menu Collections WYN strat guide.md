## **SOP: Creating Collections and Menus for What You Need in Shopify** Version 1.1

## A. Before you start

1. In Shopify admin open any What You Need product.  
     
2. Confirm tags follow the new format, for example:  
     
   - `pillar:smokeshop-device`  
   - `family:glass-bong`  
   - `material:glass`  
   - `use:flower-smoking`  
   - No tags with `b:`, `c:`, `f:`, `sc:`

If tags are still in the old format, stop and fix tagging before building collections.

---

## B. Create core collections

Path in Shopify: **Products → Collections → Create collection**

For every collection below:

- Set **Collection type** to **Automated**

You can optionally add a vendor filter if you only want What You Need:

- Extra condition: `Product vendor` **is equal to** `What You Need`

### 1\. Devices

1. **Bongs**  
     
   - Name: `Bongs`  
   - Handle: `bongs`  
   - Conditions: match any  
     - Product tag equals `family:glass-bong`  
     - Product tag equals `family:silicone-bong`

   

2. **Dab Rigs**  
     
   - Name: `Dab Rigs`  
   - Handle: `dab-rigs`  
   - Conditions: match any  
     - Product tag equals `family:glass-rig`  
     - Product tag equals `family:silicone-rig`

   

3. **Bubblers**  
     
   - Name: `Bubblers`  
   - Handle: `bubblers`  
   - Conditions: match any  
     - Product tag equals `family:bubbler`  
     - Product tag equals `family:joint-bubbler`

   

4. **Hand Pipes**  
     
   - Name: `Hand Pipes`  
   - Handle: `hand-pipes`  
   - Conditions: match any  
     - Product tag equals `family:spoon-pipe`

   

5. **One Hitters and Chillums**  
     
   - Name: `One Hitters & Chillums`  
   - Handle: `one-hitters-chillums`  
   - Conditions: match any  
     - Product tag equals `family:chillum-onehitter`

   

6. **Nectar Collectors**  
     
   - Name: `Nectar Collectors`  
   - Handle: `nectar-collectors`  
   - Conditions: match any  
     - Product tag equals `family:nectar-collector`  
     - Product tag equals `family:electronic-nectar-collector`

---

### 2\. Accessories

7. **Flower Bowls**  
     
   - Name: `Flower Bowls`  
   - Handle: `flower-bowls`  
   - Conditions:  
     - Product tag equals `family:flower-bowl`

   

8. **Quartz Bangers**  
     
   - Name: `Quartz Bangers`  
   - Handle: `quartz-bangers`  
   - Conditions:  
     - Product tag equals `family:banger`

   

9. **Carb Caps**  
     
   - Name: `Carb Caps`  
   - Handle: `carb-caps`  
   - Conditions:  
     - Product tag equals `family:carb-cap`

   

10. **Dab Tools**  
      
    - Name: `Dab Tools`  
    - Handle: `dab-tools`  
    - Conditions:  
      - Product tag equals `family:dab-tool`

    

11. **Grinders**  
      
    - Name: `Grinders`  
    - Handle: `grinders`  
    - Conditions:  
      - Product tag equals `family:grinder`

    

12. **Rolling Papers and Cones**  
      
    - Name: `Rolling Papers & Cones`  
    - Handle: `rolling-papers-cones`  
    - Conditions:  
      - Product tag equals `family:rolling-paper`

    

13. **Rolling Accessories**  
      
    - Name: `Rolling Accessories`  
    - Handle: `rolling-accessories`  
    - Conditions:  
      - Product tag equals `family:rolling-accessory`

    

14. **Trays and Work Surfaces**  
      
    - Name: `Trays & Work Surfaces`  
    - Handle: `trays-work-surfaces`  
    - Conditions:  
      - Product tag equals `family:tray`

    

15. **Torches**  
      
    - Name: `Torches`  
    - Handle: `torches`  
    - Conditions:  
      - Product tag equals `family:torch`

    

16. **Ash Catchers and Downstems**  
      
    - Name: `Ash Catchers & Downstems`  
    - Handle: `ash-catchers-downstems`  
    - Conditions: match any  
      - Product tag equals `family:ash-catcher`  
      - Product tag equals `family:downstem`

    

17. **Vapes and Electronics**  
      
    - Name: `Vapes & Electronics`  
    - Handle: `vapes-electronics`  
    - Conditions: match any  
      - Product tag equals `family:vape-battery`  
      - Product tag equals `family:vape-coil`  
      - Product tag equals `family:electronic-nectar-collector`

    

18. **Packaging and Storage**  
      
    - Name: `Packaging & Storage`  
    - Handle: `packaging-storage`  
    - Conditions: match any  
      - Product tag equals `family:storage-accessory`  
      - Product tag equals `pillar:packaging`

---

### 3\. Brand collections

Template for each brand:

- Name: `<Brand Name>`  
- Handle: brand name in lowercase with dashes  
- Conditions:  
  - Product tag equals `brand:<slug>`

Examples:

- RAW  
    
  - Name: `RAW`  
  - Handle: `raw`  
  - Condition: `Product tag` equals `brand:raw`


- Zig Zag  
    
  - Name: `Zig Zag`  
  - Handle: `zig-zag`  
  - Condition: `Product tag` equals `brand:zig-zag`

Repeat for:

- `brand:vibes`  
- `brand:elements`  
- `brand:cookies`  
- `brand:lookah`  
- `brand:puffco`  
- `brand:maven`  
- `brand:g-pen`  
- `brand:only-quartz`  
- `brand:eo-vape`  
- `brand:monark`  
- `brand:710-sci`  
- `brand:peaselburg`  
- `brand:scorch`  
- and any additional brands you use

---

### 4\. Theme collections

19. **Made In USA Glass**  
      
    - Name: `Made In USA Glass`  
    - Handle: `made-in-usa-glass`  
    - Conditions: match all  
      - Product tag equals `style:made-in-usa`  
      - Product tag equals `pillar:smokeshop-device`  
    - This keeps merch and packaging out.

    

20. **Heady Glass**  
      
    - Name: `Heady Glass`  
    - Handle: `heady-glass`  
    - Conditions:  
      - Product tag equals `style:heady`

    

21. **Silicone Rigs and Bongs**  
      
    - Name: `Silicone Rigs & Bongs`  
    - Handle: `silicone-rigs-bongs`  
    - Conditions: match any  
      - Product tag equals `material:silicone`  
    - Optional extra rules if you want only hardware:  
      - Combine `material:silicone` with families such as:  
        - `family:silicone-rig`  
        - `family:silicone-bong`  
        - `family:spoon-pipe` when the piece is clearly silicone

    

22. **Travel Friendly**  
      
    - Name: `Travel Friendly`  
    - Handle: `travel-friendly`  
    - Conditions:  
      - Product tag equals `style:travel-friendly`

    

23. **Shop All What You Need**  
      
    - Name: `Shop All What You Need`  
    - Handle: `shop-all-what-you-need`  
    - Conditions:  
      - Product vendor equals `What You Need`

    

24. **Pendants & Merch**  
      
    - Name: `Pendants & Merch`  
    - Handle: `pendants-merch`  
    - Conditions: match any  
      - Product tag equals `family:merch-pendant`  
      - Product tag equals `pillar:merch`

---

## C. Build the main menu

Path: **Online Store → Navigation → Main menu**

Use this structure:

**Shop All**  
→ link to collection: `Shop All What You Need`

**Glass**  
→ Bongs                      → collection: `Bongs`  
→ Dab Rigs                   → collection: `Dab Rigs`  
→ Bubblers                   → collection: `Bubblers`  
→ Hand Pipes                 → collection: `Hand Pipes`  
→ One Hitters & Chillums     → collection: `One Hitters & Chillums`  
→ Nectar Collectors          → collection: `Nectar Collectors`

**Accessories**  
→ Flower Bowls               → collection: `Flower Bowls`  
→ Quartz Bangers             → collection: `Quartz Bangers`  
→ Carb Caps                  → collection: `Carb Caps`  
→ Dab Tools                  → collection: `Dab Tools`  
→ Grinders                   → collection: `Grinders`  
→ Rolling Papers & Cones     → collection: `Rolling Papers & Cones`  
→ Rolling Accessories        → collection: `Rolling Accessories`  
→ Torches                    → collection: `Torches`  
→ Trays & Work Surfaces      → collection: `Trays & Work Surfaces`  
→ Ash Catchers & Downstems   → collection: `Ash Catchers & Downstems`  
→ Packaging & Storage        → collection: `Packaging & Storage`

**Brands**  
→ RAW                        → collection: `RAW`  
→ Zig Zag                    → collection: `Zig Zag`  
→ Vibes                      → collection: `Vibes`  
→ Cookies                    → collection: `Cookies`  
→ Lookah                     → collection: `Lookah`  
→ Puffco                     → collection: `Puffco`

**Themes**  
→ Heady Glass                → collection: `Heady Glass`  
→ Made In USA                → collection: `Made In USA Glass`  
→ Silicone                   → collection: `Silicone Rigs & Bongs`  
→ Travel Friendly            → collection: `Travel Friendly`

How to add each item:

1. Click **Add menu item**  
2. Set **Name** to the label (for example `Bongs`)  
3. Click **Link**, choose **Collection**, pick the correct collection  
4. Save  
5. Drag items under a parent to create dropdowns

Repeat until your menu matches the tree above.

---

## D. Quick QA checklist

Whenever you add or retag a product:

1. Check the product has:  
     
   - One `pillar:` tag  
   - One `family:` tag  
   - A `format:` tag  
   - At least one `use:` tag

   

2. Open the relevant collection page in the online store.  
     
3. Confirm the product appears there automatically.  
     
4. If not, fix the tags on the product first, not the collection conditions.

---

## 1\. Big picture: how tags feed collections and menus

Flow of logic:

1. Product gets clean tags. Example for a glass bong:  
     
   tags:  
     
   - pillar:smokeshop-device  
   - family:glass-bong  
   - material:glass  
   - format:bong  
   - use:flower-smoking  
   - brand:monark

   

2. Smart (automated) collections use those tags as conditions. Example:  
   “Bongs” collection grabs anything with `family:glass-bong` or `family:silicone-bong` and optionally vendor `What You Need`.  
     
3. Menus link to those collections.  
   Header menu items like “Bongs” just point to the “Bongs” collection URL.

This guide tells you:

- Which collections to create  
- Exact conditions for each  
- How to hook them into Shopify menus

---

## 2\. Pre‑work checklist

Before creating collections:

1. Confirm tags exist  
     
   - Pick a few random What You Need products (a bong, an accessory, a rolling item).  
   - In the product editor, check that tags look like `family:glass-bong`, `use:flower-smoking` etc, not the old `c:`, `f:`, `b:` formats.

   

2. Decide if collections are WYN‑only  
     
   For each collection, decide:  
     
   - Option A: Only What You Need products  
   - Option B: All vendors that share those tags

In most cases, using tag conditions only (no vendor condition) while only tagging WYN products that way effectively keeps collections WYN‑only.

---

## 3\. Create the core collections in Shopify (manual fallback)

If you ever need to build collections manually rather than using the automation scripts, follow this section. It mirrors section B with a bit more narrative and is safe to keep as a human SOP.

In Shopify admin:

- Products → Collections → Create collection

For all of these:

- Collection type: Automated  
- Conditions: as listed in section B

The recommended collection set is exactly what is defined in section B of this document and in the tagging spec collections section.

---

## 4\. Build the menus in Shopify (manual fallback)

Menus live separately from collections.

In Shopify admin:

- Online Store → Navigation

You will usually set up:

- Main menu (for the header)  
- Optional mega menus, depending on theme  
- Footer menus

The recommended main menu structure is exactly what is defined in section C of this document.

Steps:

1. Go to **Online Store → Navigation → Main menu**  
     
2. Click **Add menu item**  
     
3. For each item:  
     
   - Name: what you want to show in the header, like “Bongs”  
   - Link:  
     - Click the field, choose **Collections**  
     - Pick the collection you created earlier (for example “Bongs”)

   

4. For dropdowns:  
     
   - Add the parent item first  
   - Then add child items and drag them under the parent to create the hierarchy

Repeat until your menu matches the structure in section C.

---

## 5\. Day‑to‑day rules to keep everything clean

You can copy and paste this section as a SOP for anyone adding products.

### 5.1 For whoever tags products

- For every new What You Need product, apply tags according to the tagging spec (pillar, family, material, use, brand, bundle, etc).  
    
- Never add old style tags (no `b:`, `c:`, `f:` prefixes).  
    
- After saving, check that the item appears in the correct collection automatically:  
    
  - A new bong should show up in the “Bongs” collection.  
  - A new RAW cone pack should appear in “Rolling Papers & Cones” and “RAW”.

If it does not appear:

1. Check tags first (most issues are a missing or misspelled `family:*` or `brand:*` tag).  
2. Only if tags look perfect, check the collection conditions.

### 5.2 For whoever edits collections

- Do not manually add products to automated collections.  
    
- Only change collections by updating:  
    
  - Conditions (if you decide to restructure)  
  - Tag spec (for new families or brands)

If you add a brand or new family:

- Update the tagging spec so the LLM knows to use `family:new-family` or `brand:new-brand`.  
- Create a matching collection that looks for `family:new-family` or `brand:new-brand`.  
- Optional: add a menu item that links to that new collection.

