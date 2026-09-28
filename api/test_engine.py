import pytest
from engine import ExtractionResult, score_match, build_embedding_text

def test_build_embedding_text():
    ex = ExtractionResult(
        category="phone",
        colors=["blue"],
        brand="Apple",
        material="glass",
        distinguishing_features="clear case",
        short_description="blue iPhone",
        normalized_location="library",
        estimated_time="today"
    )
    text = build_embedding_text(ex)
    assert "phone" in text
    assert "Apple" in text
    assert "blue" in text

def test_score_match_same_category_and_color():
    ex = ExtractionResult(
        category="headphones",
        colors=["black"],
        brand="Sony",
        material="plastic",
        distinguishing_features="",
        short_description="black headphones",
        normalized_location="gate 7",
        estimated_time="9 PM"
    )
    
    candidate = {
        "category": "headphones",
        "colors": ["black"],
        "similarity": 0.8
    }
    
    # Base score without image:
    # Category = 15
    # Color = 10
    # Location/Time base = 15
    # Description sim = 0.8 * 60 = 48
    # Expected total = 15 + 10 + 15 + 48 = 88
    
    score = score_match(candidate, ex, has_image=False)
    assert score == 88

def test_score_match_different_category():
    ex = ExtractionResult(
        category="wallet",
        colors=["brown"],
        brand="Fossil",
        material="leather",
        distinguishing_features="",
        short_description="brown leather wallet",
        normalized_location="food court",
        estimated_time="yesterday"
    )
    
    candidate = {
        "category": "backpack",
        "colors": ["brown"],
        "similarity": 0.2
    }
    
    score = score_match(candidate, ex, has_image=True)
    # Category (0) + Color (10) + Desc (0.2 * 20 = 4) + Base(15) = 29
    assert score == 29
