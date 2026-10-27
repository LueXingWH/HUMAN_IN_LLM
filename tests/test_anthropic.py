from anthropic import Anthropic

client = Anthropic(
    api_key="sk-i-love-you",
    base_url="https://api.kirari.fun",
)

message = client.messages.create(
    model="gpt-4o-mini",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, say hi to me"}
    ],
)
print(message.content[0].text)
