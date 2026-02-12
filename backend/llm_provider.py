"""
LLM Provider 전환 모듈
환경변수 LLM_PROVIDER에 따라 Google Gemini 또는 Azure OpenAI를 반환합니다.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def get_llm(temperature: float = 0.7):
    """LLM_PROVIDER 환경변수에 따라 적절한 LLM 인스턴스를 반환합니다."""
    provider = os.getenv("LLM_PROVIDER", "google").lower()

    if provider == "azure":
        from langchain_openai import AzureChatOpenAI
        # 환경변수 우선순위: AOAI_DEPLOYMENT_NAME > AOAI_DEPLOY_GPT4O > 기본값
        deployment = os.getenv("AOAI_DEPLOYMENT_NAME") or os.getenv("AOAI_DEPLOY_GPT4O", "gpt-4o")
        return AzureChatOpenAI(
            azure_endpoint=os.getenv("AOAI_ENDPOINT"),
            api_key=os.getenv("AOAI_API_KEY"),
            azure_deployment=deployment,
            api_version=os.getenv("AOAI_API_VERSION", "2024-06-01"),
            temperature=temperature,
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        model_name = os.getenv("GOOGLE_MODEL_NAME", "gemini-2.0-flash")
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=temperature,
        )


def get_embeddings():
    """LLM_PROVIDER 환경변수에 따라 적절한 Embedding 모델을 반환합니다."""
    provider = os.getenv("LLM_PROVIDER", "google").lower()

    if provider == "azure":
        from langchain_openai import AzureOpenAIEmbeddings
        # 환경변수 우선순위: AOAI_EMBEDDING_DEPLOYMENT > AOAI_DEPLOY_EMBED_ADA > 기본값
        embed_deployment = os.getenv("AOAI_EMBEDDING_DEPLOYMENT") or os.getenv("AOAI_DEPLOY_EMBED_ADA", "text-embedding-ada-002")
        return AzureOpenAIEmbeddings(
            azure_endpoint=os.getenv("AOAI_ENDPOINT"),
            api_key=os.getenv("AOAI_API_KEY"),
            azure_deployment=embed_deployment,
            api_version=os.getenv("AOAI_API_VERSION", "2024-06-01"),
        )
    else:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        embed_model = os.getenv("GOOGLE_EMBEDDING_MODEL", "models/gemini-embedding-001")
        return GoogleGenerativeAIEmbeddings(
            model=embed_model,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
