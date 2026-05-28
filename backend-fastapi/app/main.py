from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routers import auth, categories, transactions, bills, budgets, settings, reports

settings = get_settings()
app = FastAPI(title='Personal Finance & Budgeting API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get('/')
def root():
    return {'message': 'Personal Finance & Budgeting API is running.'}

app.include_router(auth.router, prefix='/api/auth', tags=['auth'])
app.include_router(categories.router, prefix='/api/categories', tags=['categories'])
app.include_router(transactions.router, prefix='/api/transactions', tags=['transactions'])
app.include_router(bills.router, prefix='/api/bills', tags=['bills'])
app.include_router(budgets.router, prefix='/api/budgets', tags=['budgets'])
app.include_router(settings.router, prefix='/api/settings', tags=['settings'])
app.include_router(reports.router, prefix='/api/reports', tags=['reports'])
