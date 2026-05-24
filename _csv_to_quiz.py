#!/usr/bin/env python3
"""把『乘除關係康軒題庫.csv』轉成題庫格式並 append 到 quizzes.json。

策略：根據答案類型動態生成 3 個錯誤選項（distractor），轉成 4 選 1。
- 純數字答案 → ±1, ±N, *2 等變化
- 帶單位（"18個字"）→ 抓出數字變化，保留單位
- 字母（甲/乙/丙/丁）→ 固定 4 選 1
- ○/× → 2 選 1
- 兩個數字組合（"8，7"）→ 各位置變化
"""
import csv
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_FILE = ROOT.parent / "乘除關係康軒題庫.csv"
QUIZZES = ROOT / "quizzes.json"

QUIZ_ID = "Math_Multiply_Divide_Kang_Hsuan"
QUIZ_NAME = "(國小) 乘除關係 (康軒)"

random.seed(42)  # 結果可重現


# ---------- distractor generators ----------

NUM_RE = re.compile(r"(-?\d+(?:\.\d+)?)")


def _vary_int(n: int) -> list[int]:
    """為單一整數產生 3 個錯誤候選。"""
    candidates: list[int] = []
    abs_n = abs(n) if n != 0 else 1
    delta_small = max(1, abs_n // 10)
    deltas = [+1, -1, +2, -2, +delta_small, -delta_small, +abs_n, -abs_n]
    if n > 10:
        deltas += [n // 2, n * 2, n + 10, n - 10]
    seen = {n}
    for d in deltas:
        v = n + d if abs(d) <= delta_small * 2 else d
        # 上一行有點亂，簡化：直接生候選列表
    # 重新乾淨版
    options = set()
    for d in [+1, -1, +2, -2]:
        options.add(n + d)
    if abs_n >= 10:
        options.add(n + 10)
        options.add(n - 10)
        options.add(n * 2)
        if n % 2 == 0:
            options.add(n // 2)
    if abs_n >= 100:
        options.add(n + 100)
        options.add(n - 100)
    # 去掉 n 本身、去掉負數結果（如果 n 是正數）
    options.discard(n)
    if n > 0:
        options = {x for x in options if x > 0}
    return list(options)


def _gen_for_number(answer_str: str) -> list[str] | None:
    """純數字答案（可能帶小數）。"""
    m = NUM_RE.fullmatch(answer_str.strip())
    if not m:
        return None
    try:
        n = float(answer_str)
        n_int = int(n) if n.is_integer() else None
    except ValueError:
        return None
    if n_int is None:
        return None
    pool = _vary_int(n_int)
    random.shuffle(pool)
    return [str(x) for x in pool[:3]]


def _gen_for_number_with_unit(answer_str: str) -> list[str] | None:
    """『18個字』『161盒，剩下1個』之類 — 抓第一個數字變化，其它保留。"""
    m = NUM_RE.search(answer_str)
    if not m:
        return None
    try:
        n = int(m.group(1))
    except ValueError:
        return None
    pool = _vary_int(n)
    random.shuffle(pool)
    pool = pool[:3]
    if len(pool) < 3:
        return None
    prefix = answer_str[: m.start()]
    suffix = answer_str[m.end() :]
    return [f"{prefix}{x}{suffix}" for x in pool]


CHAR_CHOICES = {
    "甲": ["甲", "乙", "丙", "丁"],
    "乙": ["甲", "乙", "丙", "丁"],
    "丙": ["甲", "乙", "丙", "丁"],
    "丁": ["甲", "乙", "丙", "丁"],
}


def _gen_for_char(answer_str: str) -> list[str] | None:
    a = answer_str.strip()
    if a in CHAR_CHOICES:
        opts = CHAR_CHOICES[a].copy()
        opts.remove(a)
        return opts
    return None


def _gen_general_number_vary(answer_str: str) -> list[str] | None:
    """通用：保留答案的原句結構，把所有整數做 ±N 變化生成 distractor。

    例：
      '161盒，剩下1個' → ['162盒，剩下1個', '160盒，剩下1個', '161盒，剩下2個']
      '8，7' → ['9，7', '8，8', '7，7']
      '18個字' → ['19個字', '17個字', '20個字']
    """
    matches = list(NUM_RE.finditer(answer_str))
    if not matches:
        return None
    nums = []
    for m in matches:
        s = m.group(1)
        if "." in s:
            return None  # 有小數的留給 _gen_for_number 處理
        try:
            nums.append(int(s))
        except ValueError:
            return None
    if not nums:
        return None

    def rebuild(new_nums: list[int]) -> str:
        parts = []
        cursor = 0
        for i, m in enumerate(matches):
            parts.append(answer_str[cursor : m.start()])
            parts.append(str(new_nums[i]))
            cursor = m.end()
        parts.append(answer_str[cursor:])
        return "".join(parts)

    distractors: set[str] = set()
    for i in range(len(nums)):
        abs_n = abs(nums[i]) if nums[i] != 0 else 1
        deltas = [+1, -1, +2, -2]
        if abs_n >= 10:
            deltas += [+10, -10]
        if abs_n >= 100:
            deltas += [+100, -100]
        for d in deltas:
            new_nums = nums.copy()
            new_val = nums[i] + d
            if new_val <= 0 and nums[i] > 0:
                continue
            new_nums[i] = new_val
            new_ans = rebuild(new_nums)
            if new_ans != answer_str:
                distractors.add(new_ans)
    out = list(distractors)
    random.shuffle(out)
    return out[:3] if len(out) >= 3 else None


def _gen_for_yes_no(answer_str: str) -> list[str] | None:
    a = answer_str.strip()
    if a in ("○", "X", "×", "x", "v", "V"):
        return ["×" if a == "○" else "○"]
    return None


DISTRACTOR_GENS = [
    _gen_for_yes_no,
    _gen_for_char,
    _gen_for_number,
    _gen_general_number_vary,
    _gen_for_number_with_unit,
]


def gen_options(answer: str) -> tuple[list[str], int]:
    """回傳 (options, correct_idx_1based)。若無法生成，使用 fallback。"""
    answer = answer.strip()
    distractors: list[str] | None = None
    for gen in DISTRACTOR_GENS:
        result = gen(answer)
        if result and len(result) >= 1:
            distractors = result
            break

    if distractors is None or len(distractors) < 1:
        # 完全無法生成 → 用通用 fallback
        distractors = ["以上皆非", "無法判斷", "資料不足"]

    # 取 3 個（或少於 3 的話補通用 fallback）
    while len(distractors) < 3:
        for fallback in ["以上皆非", "無法判斷", "資料不足", "0"]:
            if fallback not in distractors and fallback != answer:
                distractors.append(fallback)
                break

    distractors = distractors[:3]
    # 隨機決定正解位置
    options = distractors + [answer]
    random.shuffle(options)
    correct_idx = options.index(answer) + 1
    return options, correct_idx


# ---------- 主流程 ----------


def main():
    if not CSV_FILE.exists():
        raise SystemExit(f"找不到: {CSV_FILE}")

    with open(CSV_FILE, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    print(f"讀取 {len(rows)} 題")

    questions = []
    skipped = 0
    type_counts: dict[str, int] = {}
    for row in rows:
        q_text = (row.get("題目") or "").strip()
        a_text = (row.get("答案") or "").strip()
        diff = (row.get("難度") or "").strip()
        topic = (row.get("知識點") or "").strip()
        qtype = (row.get("題型") or "").strip()

        if not q_text or not a_text:
            skipped += 1
            continue

        # 題幹加註類型與難度（小字）— 讓玩家了解上下文
        # 例：[應用題·易] 題目
        tag = f"【{qtype}·{diff}】" if qtype and diff else ""
        full_q = f"{tag} {q_text}" if tag else q_text

        options, correct = gen_options(a_text)
        questions.append({
            "type": 0,
            "q": full_q,
            "options": options,
            "answer": correct,
            "q_image": None,
            "option_images": None,
        })
        type_counts[qtype] = type_counts.get(qtype, 0) + 1

    print(f"\n處理結果:")
    print(f"  生成題目: {len(questions)}")
    print(f"  跳過: {skipped}")
    print(f"  類型分布: {type_counts}")

    # append 到 quizzes.json
    data = json.loads(QUIZZES.read_text(encoding="utf-8"))
    # 如果已存在同 id，先移除舊版
    data["quizzes"] = [q for q in data["quizzes"] if q.get("id") != QUIZ_ID]
    new_quiz = {
        "id": QUIZ_ID,
        "name": QUIZ_NAME,
        "txt_flag": 1,
        "total": len(questions),
        "questions": questions,
    }
    data["quizzes"].append(new_quiz)
    # 重新排序（用名稱）
    data["quizzes"].sort(key=lambda x: x["name"])

    QUIZZES.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n✓ 寫入 {QUIZZES}")
    print(f"  題庫『{QUIZ_NAME}』{len(questions)} 題已加入")
    print(f"  目前題庫總數: {len(data['quizzes'])}")

    # 印幾題範例驗證
    print(f"\n=== 範例題目 (前 5 題) ===")
    for q in questions[:5]:
        print(f"\nQ: {q['q']}")
        for i, opt in enumerate(q['options'], 1):
            mark = " ★" if i == q['answer'] else ""
            print(f"  {chr(64+i)}: {opt}{mark}")


if __name__ == "__main__":
    main()
