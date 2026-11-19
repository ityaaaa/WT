# WT
Run: cd mysteria && python3 -m http.server 8000  → open http://localhost:8000

(XML is loaded with fetch(), so the page must be served over HTTP, not opened as a file.)


data/cases.xml     storylines, suspects, locations, clues, motives, solutions

data/puzzles.xml   puzzles, answers, hints

data/levels.xml    difficulty levels and scoring penalties

data/progress.xml  player progress seed (results saved as XML in localStorage)

data/cases.xsd     schema for cases.xml

data/case.xsl      XSLT: suspect board + solution reveal
