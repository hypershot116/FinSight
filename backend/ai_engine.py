import requests

def call_llm(provider: str, key: str, prompt: str, json_mode: bool = False):
    provider = provider.lower()
    try:
        if provider == "groq":
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.1}
            if json_mode: payload["response_format"] = {"type": "json_object"}
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
            
        elif provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "temperature": 0.1}
            if json_mode: payload["response_format"] = {"type": "json_object"}
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
            
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
            payload = {"contents": [{"parts":[{"text": prompt}]}]}
            if json_mode: payload["generationConfig"] = {"responseMimeType": "application/json", "temperature": 0.1}
            r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
            
        elif provider == "anthropic":
            url = "https://api.anthropic.com/v1/messages"
            headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
            if json_mode: prompt += "\n\nRespond ONLY with valid JSON. Do not include markdown."
            payload = {"model": "claude-3-haiku-20240320", "max_tokens": 512, "messages": [{"role": "user", "content": prompt}]}
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            r.raise_for_status()
            return r.json()["content"][0]["text"]
            
        else:
            raise ValueError(f"Unknown provider: {provider}")
    except requests.exceptions.RequestException as e:
        err = e.response.json() if e.response else str(e)
        raise Exception(f"API Error: {err}")
