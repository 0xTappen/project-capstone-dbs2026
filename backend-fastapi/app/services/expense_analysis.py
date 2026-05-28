from __future__ import annotations

# Modul ini berisi logika analisis pola pengeluaran.
# Tujuannya supaya router tetap tipis, sedangkan perhitungan bisnis disimpan terpisah.

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import GridSearchCV
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from ..config import get_settings


# Ambang ini mengikuti ide di notebook, tetapi dibuat sebagai konstanta
# supaya gampang diubah dan dibaca.
HEALTHY_LABEL = 'Sehat'
WARNING_LABEL = 'Perlu Perhatian'
CRITICAL_LABEL = 'Kritis'
NOTEBOOK_REFERENCE_METRICS = {
    'random_forest_accuracy': 1.0,
    'gradient_boosting_accuracy': 1.0,
    'svm_accuracy': 0.75,
    'random_forest_cv_f1_mean': 0.760,
    'gradient_boosting_cv_f1_mean': 0.898,
    'svm_cv_f1_mean': 0.576,
    'gradient_boosting_tuned_cv_f1_mean': 0.903,
    'best_test_model': 'Random Forest',
    'best_cv_model': 'Gradient Boosting',
    'best_tuned_params': {
        'learning_rate': 0.01,
        'max_depth': 3,
        'n_estimators': 50,
        'subsample': 1.0,
    },
}


@dataclass
class ModelTrainingResult:
    # Dataclass dipakai agar hasil training lebih rapi saat dipassing ke response API.
    status: str
    message: str
    metrics: dict[str, Any]
    class_distribution: dict[str, int]
    sample_size: int
    data_sources: list[str]


def normalize_transaction_type(value: Any) -> str:
    # Fungsi ini menyamakan variasi penulisan tipe transaksi.
    lowered = str(value or '').strip().lower()
    if lowered in {'income', 'pemasukan', 'masuk'}:
        return 'income'
    if lowered in {'expense', 'pengeluaran', 'keluar'}:
        return 'expense'
    return lowered


def build_transactions_dataframe(rows: list[dict[str, Any]]) -> pd.DataFrame:
    # Data dari database diubah dulu menjadi DataFrame agar mudah dianalisis
    # dengan operasi grup per bulan dan kategori seperti di notebook.
    if not rows:
        return pd.DataFrame(columns=['id', 'category_name', 'type', 'amount', 'description', 'transaction_date'])

    frame = pd.DataFrame(rows)
    frame['type'] = frame['type'].map(normalize_transaction_type)
    frame['amount'] = pd.to_numeric(frame['amount'], errors='coerce').fillna(0.0)
    frame['transaction_date'] = pd.to_datetime(frame['transaction_date'], errors='coerce')
    frame['category_name'] = frame['category_name'].fillna('Tanpa Kategori')
    frame = frame.dropna(subset=['transaction_date']).copy()

    # Fitur turunan waktu ini dibutuhkan untuk pola bulanan dan harian.
    frame['month'] = frame['transaction_date'].dt.month
    frame['year'] = frame['transaction_date'].dt.year
    frame['day'] = frame['transaction_date'].dt.day
    frame['day_name'] = frame['transaction_date'].dt.day_name()
    return frame


def load_reference_dataset() -> pd.DataFrame:
    # Dataset CSV dipakai sebagai data referensi tambahan.
    # Ini berguna saat data transaksi user masih sedikit.
    settings = get_settings()
    dataset_path = Path(__file__).resolve().parents[2] / settings.dataset_csv_path

    if not settings.use_dataset_for_training or not dataset_path.exists():
        return pd.DataFrame()

    frame = pd.read_csv(dataset_path)
    required_columns = {'Date', 'Category', 'Amount', 'Type'}
    if not required_columns.issubset(frame.columns):
        return pd.DataFrame()

    normalized = pd.DataFrame(
        {
            'id': range(1, len(frame) + 1),
            'category_name': frame['Category'],
            'type': frame['Type'],
            'amount': frame['Amount'],
            'description': frame['Transaction Description'] if 'Transaction Description' in frame.columns else None,
            'transaction_date': frame['Date'],
        }
    )
    return build_transactions_dataframe(normalized.to_dict(orient='records'))


def build_notebook_exact_monthly_features() -> pd.DataFrame:
    # Fungsi ini sengaja dibuat mengikuti notebook referensi seketat mungkin.
    frame = load_reference_dataset()
    if frame.empty:
        return pd.DataFrame()

    monthly = frame.groupby(['year', 'month', 'type'])['amount'].sum().unstack(fill_value=0)
    if 'income' not in monthly.columns:
        monthly['income'] = 0.0
    if 'expense' not in monthly.columns:
        monthly['expense'] = 0.0

    monthly['cashflow'] = monthly['income'] - monthly['expense']
    monthly['expense_ratio'] = monthly['expense'] / (monthly['income'] + 1.0)
    monthly['condition'] = monthly['cashflow'].apply(label_financial_condition)
    monthly = monthly.reset_index()

    freq = frame.groupby(['year', 'month']).size().reset_index(name='freq_transactions')
    expense_cat = (
        frame.loc[frame['type'] == 'expense']
        .groupby(['year', 'month'])['amount']
        .mean()
        .reset_index(name='avg_expense')
    )

    result = monthly.merge(freq, on=['year', 'month']).merge(expense_cat, on=['year', 'month'])
    return result


def combine_training_sources(user_frame: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    # Model akan belajar dari data user, lalu opsional ditambah dataset referensi.
    sources = ['database']
    combined = user_frame.copy()
    reference_frame = load_reference_dataset()

    if not reference_frame.empty:
        combined = pd.concat([combined, reference_frame], ignore_index=True)
        sources.append('dataset_csv')

    return combined, sources


def train_notebook_exact_model() -> ModelTrainingResult:
    # Mode ini ditujukan untuk menjaga hasil tetap selaras dengan notebook.
    # Sumber data dipaksa hanya dari CSV referensi notebook.
    monthly = build_notebook_exact_monthly_features()
    if monthly.empty:
        return ModelTrainingResult(
            status='dataset_missing',
            message='Dataset referensi notebook tidak ditemukan atau tidak valid.',
            metrics={},
            class_distribution={},
            sample_size=0,
            data_sources=['dataset_csv'],
        )

    feature_columns = ['income', 'expense', 'cashflow', 'expense_ratio', 'freq_transactions', 'avg_expense', 'month']
    X = monthly[feature_columns]
    y = monthly['condition']

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    rf = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)
    gb = GradientBoostingClassifier(n_estimators=100, random_state=42)
    svm = SVC(kernel='rbf', class_weight='balanced', random_state=42)

    rf.fit(X_train, y_train)
    gb.fit(X_train, y_train)
    svm.fit(X_train_sc, y_train)

    models = {
        'Random Forest': (rf, X_test),
        'Gradient Boosting': (gb, X_test),
        'SVM': (svm, X_test_sc),
    }

    test_results: dict[str, dict[str, Any]] = {}
    for name, (model, X_eval) in models.items():
        predictions = model.predict(X_eval)
        test_results[name] = {
            'accuracy': round(float(accuracy_score(y_test, predictions)), 4),
            'classification_report': classification_report(y_test, predictions, output_dict=True, zero_division=0),
        }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    X_cv = {
        'Random Forest': X,
        'Gradient Boosting': X,
        'SVM': pd.DataFrame(scaler.fit_transform(X), columns=X.columns),
    }
    cv_results: dict[str, dict[str, Any]] = {}
    for name, model in {'Random Forest': rf, 'Gradient Boosting': gb, 'SVM': svm}.items():
        scores = cross_val_score(model, X_cv[name], y, cv=cv, scoring='f1_macro')
        cv_results[name] = {
            'fold_scores': [round(float(score), 3) for score in scores],
            'mean': round(float(scores.mean()), 3),
            'std': round(float(scores.std()), 3),
        }

    grid_search = GridSearchCV(
        GradientBoostingClassifier(random_state=42),
        {
            'n_estimators': [50, 100, 200],
            'max_depth': [2, 3, 5],
            'learning_rate': [0.01, 0.1, 0.2],
            'subsample': [0.8, 1.0],
        },
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        scoring='f1_macro',
        n_jobs=-1,
        verbose=0,
    )
    grid_search.fit(X, y)

    metrics = {
        'mode': 'notebook_exact',
        'feature_columns': feature_columns,
        'training_rows': int(len(monthly)),
        'class_distribution': {key: int(value) for key, value in y.value_counts().to_dict().items()},
        'test_results': test_results,
        'cv_results': cv_results,
        'tuned_gradient_boosting': {
            'best_params': grid_search.best_params_,
            'best_score': round(float(grid_search.best_score_), 3),
        },
        # Nilai referensi notebook disertakan agar frontend/consumer bisa menampilkan target tetap.
        'notebook_reference_metrics': NOTEBOOK_REFERENCE_METRICS,
    }

    return ModelTrainingResult(
        status='ok',
        message='Model dijalankan dengan mode notebook exact agar mengikuti pipeline notebook referensi.',
        metrics=metrics,
        class_distribution={key: int(value) for key, value in y.value_counts().to_dict().items()},
        sample_size=int(len(monthly)),
        data_sources=['dataset_csv'],
    )


def build_expense_pattern_analysis(frame: pd.DataFrame) -> dict[str, Any]:
    # Endpoint analisis utama akan memakai fungsi ini.
    if frame.empty:
        return {
            'summary': {
                'total_transactions': 0,
                'total_income': 0,
                'total_expense': 0,
                'net_cashflow': 0,
            },
            'top_expense_categories': [],
            'monthly_expense_trend': [],
            'spike_days': [],
            'small_repeat_expenses': [],
            'insights': ['Belum ada data transaksi yang cukup untuk dianalisis.'],
        }

    income_total = float(frame.loc[frame['type'] == 'income', 'amount'].sum())
    expense_frame = frame.loc[frame['type'] == 'expense'].copy()
    expense_total = float(expense_frame['amount'].sum())

    # Kategori pengeluaran terbesar membantu menjawab pertanyaan bisnis pertama.
    top_categories = (
        expense_frame.groupby('category_name', dropna=False)['amount']
        .agg(['sum', 'count'])
        .sort_values('sum', ascending=False)
        .head(5)
        .reset_index()
    )
    top_categories['recommended_reduction_15pct'] = (top_categories['sum'] * 0.15).round(2)

    # Ringkasan per bulan dipakai untuk melihat tren fluktuasi pengeluaran.
    monthly_expense = (
        expense_frame.groupby(['year', 'month'])['amount']
        .sum()
        .reset_index()
        .sort_values(['year', 'month'])
    )
    monthly_expense['change_from_previous'] = monthly_expense['amount'].diff().fillna(0).round(2)

    # Analisis lonjakan harian sederhana: hari dengan pengeluaran di atas persentil 90.
    daily_expense = (
        expense_frame.groupby(expense_frame['transaction_date'].dt.date)['amount']
        .sum()
        .reset_index(name='amount')
        .sort_values('amount', ascending=False)
    )
    spike_threshold = float(daily_expense['amount'].quantile(0.90)) if not daily_expense.empty else 0.0
    spike_days = daily_expense.loc[daily_expense['amount'] >= spike_threshold].head(5)

    # Deteksi transaksi kecil berulang sebagai sinyal pengeluaran impulsif.
    small_repeat = expense_frame.loc[expense_frame['amount'] <= expense_frame['amount'].median()].copy()
    small_repeat_summary = (
        small_repeat.groupby(['category_name', 'day_name'])['amount']
        .agg(['count', 'sum'])
        .reset_index()
        .sort_values(['count', 'sum'], ascending=[False, False])
        .head(5)
    )

    insights: list[str] = []
    if not top_categories.empty:
        top_row = top_categories.iloc[0]
        insights.append(
            f"Kategori pengeluaran terbesar adalah {top_row['category_name']} dengan total {top_row['sum']:.2f}."
        )
        insights.append(
            f"Jika target pengurangan 15% diterapkan, potensi penghematan kategori ini sekitar {top_row['recommended_reduction_15pct']:.2f}."
        )

    if len(monthly_expense) >= 2:
        latest = monthly_expense.iloc[-1]
        previous = monthly_expense.iloc[-2]
        direction = 'naik' if latest['amount'] > previous['amount'] else 'turun'
        insights.append(
            f"Pengeluaran bulan terakhir {direction} dibanding bulan sebelumnya sebesar {latest['change_from_previous']:.2f}."
        )

    if not spike_days.empty:
        top_spike = spike_days.iloc[0]
        insights.append(
            f"Lonjakan pengeluaran tertinggi terjadi pada {top_spike['transaction_date']} dengan nilai {top_spike['amount']:.2f}."
        )

    if not small_repeat_summary.empty:
        repeat_row = small_repeat_summary.iloc[0]
        insights.append(
            f"Ada pola transaksi kecil berulang pada kategori {repeat_row['category_name']} di hari {repeat_row['day_name']}."
        )

    return {
        'summary': {
            'total_transactions': int(len(frame)),
            'total_income': round(income_total, 2),
            'total_expense': round(expense_total, 2),
            'net_cashflow': round(income_total - expense_total, 2),
        },
        'top_expense_categories': top_categories.rename(columns={'category_name': 'category', 'sum': 'total_amount', 'count': 'transaction_count'}).to_dict(orient='records'),
        'monthly_expense_trend': monthly_expense.rename(columns={'amount': 'total_amount'}).to_dict(orient='records'),
        'spike_days': spike_days.to_dict(orient='records'),
        'small_repeat_expenses': small_repeat_summary.rename(columns={'category_name': 'category', 'count': 'transaction_count', 'sum': 'total_amount'}).to_dict(orient='records'),
        'insights': insights,
    }


def label_financial_condition(cashflow: float) -> str:
    # Label kondisi keuangan mengikuti pendekatan notebook agar tetap konsisten.
    if cashflow > 0:
        return HEALTHY_LABEL
    if cashflow >= -5000:
        return WARNING_LABEL
    return CRITICAL_LABEL


def build_monthly_features(frame: pd.DataFrame) -> pd.DataFrame:
    # Fitur bulanan digunakan untuk model klasifikasi kondisi keuangan.
    if frame.empty:
        return pd.DataFrame()

    monthly = (
        frame.groupby(['year', 'month', 'type'])['amount']
        .sum()
        .unstack(fill_value=0)
        .reset_index()
    )

    if 'income' not in monthly.columns:
        monthly['income'] = 0.0
    if 'expense' not in monthly.columns:
        monthly['expense'] = 0.0

    monthly['cashflow'] = monthly['income'] - monthly['expense']
    monthly['expense_ratio'] = monthly['expense'] / (monthly['income'] + 1.0)
    monthly['condition'] = monthly['cashflow'].apply(label_financial_condition)

    # Tambah frekuensi transaksi dan rata-rata expense seperti di notebook.
    freq = frame.groupby(['year', 'month']).size().reset_index(name='freq_transactions')
    expense_avg = (
        frame.loc[frame['type'] == 'expense']
        .groupby(['year', 'month'])['amount']
        .mean()
        .reset_index(name='avg_expense')
    )

    merged = monthly.merge(freq, on=['year', 'month'], how='left').merge(expense_avg, on=['year', 'month'], how='left')
    merged['avg_expense'] = merged['avg_expense'].fillna(0.0)
    merged['freq_transactions'] = merged['freq_transactions'].fillna(0)
    return merged


def train_financial_health_model(frame: pd.DataFrame) -> ModelTrainingResult:
    # Training dilakukan dari data transaksi user saat ini.
    # Karena datanya dinamis, metrik akurasi juga akan berubah sesuai kualitas dan jumlah data user.
    settings = get_settings()
    if settings.training_mode == 'notebook_exact':
        return train_notebook_exact_model()

    training_frame, data_sources = combine_training_sources(frame)
    monthly = build_monthly_features(training_frame)

    if monthly.empty or len(monthly) < 6:
        return ModelTrainingResult(
            status='insufficient_data',
            message='Data bulanan belum cukup. Minimal butuh 6 bulan data untuk training awal.',
            metrics={},
            class_distribution={},
            sample_size=int(len(monthly)),
            data_sources=data_sources,
        )

    class_distribution = monthly['condition'].value_counts().to_dict()
    if len(class_distribution) < 2:
        return ModelTrainingResult(
            status='insufficient_classes',
            message='Label kondisi keuangan hanya satu kelas, sehingga model klasifikasi belum bisa dilatih dengan baik.',
            metrics={},
            class_distribution=class_distribution,
            sample_size=int(len(monthly)),
            data_sources=data_sources,
        )

    feature_columns = ['income', 'expense', 'cashflow', 'expense_ratio', 'freq_transactions', 'avg_expense', 'month']
    X = monthly[feature_columns]
    y = monthly['condition']

    # Holdout test dipakai untuk gambaran sederhana akurasi model pada data yang tidak dilatih.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = GradientBoostingClassifier(random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    # Cross validation dipakai karena jumlah sampel bulanan biasanya sedikit.
    min_class_count = int(min(class_distribution.values()))
    cv_splits = max(2, min(5, min_class_count))
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=cv, scoring='f1_macro')

    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    metrics = {
        'holdout_accuracy': round(float(accuracy_score(y_test, predictions)), 4),
        'holdout_f1_macro': round(float(f1_score(y_test, predictions, average='macro')), 4),
        'cross_validation_f1_macro_mean': round(float(cv_scores.mean()), 4),
        'cross_validation_f1_macro_std': round(float(cv_scores.std()), 4),
        'classification_report': report,
        'feature_columns': feature_columns,
        'training_rows': int(len(training_frame)),
        'monthly_rows': int(len(monthly)),
    }

    return ModelTrainingResult(
        status='ok',
        message='Model berhasil dilatih dari data transaksi yang tersedia saat ini.',
        metrics=metrics,
        class_distribution={key: int(value) for key, value in class_distribution.items()},
        sample_size=int(len(monthly)),
        data_sources=data_sources,
    )
