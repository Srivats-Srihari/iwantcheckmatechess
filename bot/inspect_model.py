import os
import json

info = {}

# Try to inspect PyTorch model
pt_path = r"C:\Users\sriva\iwantcheckmatechess\bot\Models\White\Blitz\pytorch_model.pt"
if os.path.exists(pt_path):
    info["pytorch"] = {"exists": True}
    try:
        import torch
        checkpoint = torch.load(pt_path, map_location='cpu')
        info["pytorch"]["type"] = str(type(checkpoint))
        if isinstance(checkpoint, dict):
            info["pytorch"]["keys"] = list(checkpoint.keys())
            state_dict = checkpoint.get("state_dict", checkpoint)
            info["pytorch"]["state_dict_keys_count"] = len(state_dict)
            shapes = {}
            for k, v in list(state_dict.items())[:15]:
                if hasattr(v, "shape"):
                    shapes[k] = list(v.shape)
            info["pytorch"]["shapes"] = shapes
        else:
            info["pytorch"]["str"] = str(checkpoint)[:500]
            if hasattr(checkpoint, 'state_dict'):
                shapes = {}
                for k, v in list(checkpoint.state_dict().items())[:15]:
                    shapes[k] = list(v.shape)
                info["pytorch"]["shapes"] = shapes
    except Exception as e:
        info["pytorch"]["error"] = str(e)
else:
    info["pytorch"] = {"exists": False, "error": "Not found"}

# Try to inspect ONNX model
onnx_path = r"C:\Users\sriva\iwantcheckmatechess\bot\Models\White\Blitz\model.onnx"
if os.path.exists(onnx_path):
    info["onnx"] = {"exists": True}
    try:
        import onnx
        model = onnx.load(onnx_path)
        info["onnx"]["ir_version"] = model.ir_version
        
        # Inputs
        inputs = []
        for inp in model.graph.input:
            dim_info = []
            for dim in inp.type.tensor_type.shape.dim:
                if dim.HasField("dim_value"):
                    dim_info.append(dim.dim_value)
                elif dim.HasField("dim_param"):
                    dim_info.append(dim.dim_param)
                else:
                    dim_info.append("?")
            inputs.append({"name": inp.name, "shape": dim_info, "type": inp.type.tensor_type.elem_type})
        info["onnx"]["inputs"] = inputs
        
        # Outputs
        outputs = []
        for out in model.graph.output:
            dim_info = []
            for dim in out.type.tensor_type.shape.dim:
                if dim.HasField("dim_value"):
                    dim_info.append(dim.dim_value)
                elif dim.HasField("dim_param"):
                    dim_info.append(dim.dim_param)
                else:
                    dim_info.append("?")
            outputs.append({"name": out.name, "shape": dim_info, "type": out.type.tensor_type.elem_type})
        info["onnx"]["outputs"] = outputs
        
    except Exception as e:
        info["onnx"]["error"] = str(e)
else:
    info["onnx"] = {"exists": False, "error": "Not found"}

out_path = r"C:\Users\sriva\iwantcheckmatechess\bot\model_info.txt"
with open(out_path, "w") as f:
    json.dump(info, f, indent=2)
print("Done writing inspect info!")
