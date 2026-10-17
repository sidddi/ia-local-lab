"""Genera un model NER minúscul NOMÉS per a tests de fontaneria (càrrega local, WASM, prova sense connexió).

No és un model de veritat: marca com a persona (B-PER) la primera lletra de cada paraula
que comença amb majúscula. No té cap qualitat i no s'ha de fer servir per puntuar res.

Ús: python3 scripts/make-tiny-ner.py   (necessita els paquets onnx i numpy)
"""
import json
import pathlib
import string

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "models" / "lab-fixtures" / "tiny-ner-test"
LABELS = ["O", "B-DATE", "I-DATE", "B-PER", "I-PER", "B-ORG", "I-ORG", "B-LOC", "I-LOC"]
SPECIAL = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"]

chars = sorted(set(string.ascii_letters + string.digits + string.punctuation + "àèéíïòóúüçÀÈÉÍÏÒÓÚÜÇñÑáÁ·ºª²€"))
vocab = SPECIAL + chars + ["##" + c for c in chars]
ids = {t: i for i, t in enumerate(vocab)}

# "Embedding" = logits directes per token.
E = np.zeros((len(vocab), len(LABELS)), dtype=np.float32)
E[:, 0] = 1.0
for tok, i in ids.items():
    if len(tok) == 1 and tok.isupper():
        E[i, 3] = 3.0  # B-PER

E_init = numpy_helper.from_array(E, name="E")
inp = helper.make_tensor_value_info("input_ids", TensorProto.INT64, ["batch", "seq"])
out = helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", "seq", len(LABELS)])
node = helper.make_node("Gather", ["E", "input_ids"], ["logits"], axis=0)
graph = helper.make_graph([node], "tiny_ner_test", [inp], [out], initializer=[E_init])
model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)], producer_name="ia-local-lab")
model.ir_version = 8
onnx.checker.check_model(model)

(OUT / "onnx").mkdir(parents=True, exist_ok=True)
for name in ("model.onnx", "model_quantized.onnx"):
    onnx.save(model, OUT / "onnx" / name)

config = {
    "model_type": "bert",
    "architectures": ["BertForTokenClassification"],
    "id2label": {str(i): l for i, l in enumerate(LABELS)},
    "label2id": {l: i for i, l in enumerate(LABELS)},
    "vocab_size": len(vocab),
    "hidden_size": len(LABELS),
    "num_attention_heads": 1,
    "num_hidden_layers": 0,
    "max_position_embeddings": 512,
    "_comment": "Model de prova generat per scripts/make-tiny-ner.py. Sense qualitat.",
}
(OUT / "config.json").write_text(json.dumps(config, indent=2) + "\n")

special = lambda t: {"id": t, "type_id": 0}
tokenizer = {
    "version": "1.0",
    "truncation": None,
    "padding": None,
    "added_tokens": [
        {"id": ids[t], "content": t, "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True}
        for t in SPECIAL
    ],
    "normalizer": {"type": "BertNormalizer", "clean_text": True, "handle_chinese_chars": True, "strip_accents": False, "lowercase": False},
    "pre_tokenizer": {"type": "BertPreTokenizer"},
    "post_processor": {
        "type": "TemplateProcessing",
        "single": [{"SpecialToken": special("[CLS]")}, {"Sequence": {"id": "A", "type_id": 0}}, {"SpecialToken": special("[SEP]")}],
        "pair": [
            {"SpecialToken": special("[CLS]")},
            {"Sequence": {"id": "A", "type_id": 0}},
            {"SpecialToken": special("[SEP]")},
            {"Sequence": {"id": "B", "type_id": 1}},
            {"SpecialToken": {"id": "[SEP]", "type_id": 1}},
        ],
        "special_tokens": {t: {"id": t, "ids": [ids[t]], "tokens": [t]} for t in ("[CLS]", "[SEP]")},
    },
    "decoder": {"type": "WordPiece", "prefix": "##", "cleanup": True},
    "model": {"type": "WordPiece", "unk_token": "[UNK]", "continuing_subword_prefix": "##", "max_input_chars_per_word": 100, "vocab": ids},
}
(OUT / "tokenizer.json").write_text(json.dumps(tokenizer, ensure_ascii=False) + "\n")
(OUT / "tokenizer_config.json").write_text(
    json.dumps(
        {
            "tokenizer_class": "BertTokenizer",
            "do_lower_case": False,
            "model_max_length": 512,
            "cls_token": "[CLS]",
            "sep_token": "[SEP]",
            "pad_token": "[PAD]",
            "unk_token": "[UNK]",
            "mask_token": "[MASK]",
        },
        indent=2,
    )
    + "\n"
)
print(f"Model de prova a {OUT}")
