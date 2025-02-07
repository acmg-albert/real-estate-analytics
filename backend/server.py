from fastapi import FastAPI, Query, Path
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import pandas as pd
from io import StringIO
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from fastapi import HTTPException
import re
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://real-estate-analytics.vercel.app",  # Vercel前端地址
        "http://localhost:5173",  # 本地开发地址
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据URL
REALTOR_URLS = {
    'national': 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Country_History.csv',
    'state': 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State_History.csv',
    'metro': 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Metro_History.csv',
    'county': 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_County_History.csv',
    'zip': 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip_History.csv'
}

ZILLOW_URLS = {
    'allHomes': 'https://files.zillowstatic.com/research/public_csvs/median_sale_price/Metro_median_sale_price_uc_sfrcondo_sm_month.csv',
    'sfrOnly': 'https://files.zillowstatic.com/research/public_csvs/median_sale_price/Metro_median_sale_price_uc_sfr_sm_month.csv'
}

# 添加Zillow可负担性数据URL
ZILLOW_AFFORDABILITY_URLS = {
    'homeowner': 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'renter': 'https://files.zillowstatic.com/research/public_csvs/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv',
    'total_payment': 'https://files.zillowstatic.com/research/public_csvs/total_monthly_payment/Metro_total_monthly_payment_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'mortgage_payment': 'https://files.zillowstatic.com/research/public_csvs/mortgage_payment/Metro_mortgage_payment_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'affordable_price': 'https://files.zillowstatic.com/research/public_csvs/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'median_price': 'https://files.zillowstatic.com/research/public_csvs/median_sale_price/Metro_median_sale_price_uc_sfrcondo_sm_sa_month.csv'
}

# 地区列名映射
REGION_COLUMNS = {
    'national': 'country',
    'state': 'state',
    'metro': 'cbsa_title',
    'county': 'county_name',
    'zip': 'postal_code'
}

@app.get("/api/zillow-data")
async def get_zillow_data():
    async with httpx.AsyncClient() as client:
        try:
            responses = await asyncio.gather(
                client.get(ZILLOW_URLS['allHomes']),
                client.get(ZILLOW_URLS['sfrOnly'])
            )
            
            return {
                "allHomes": responses[0].text,
                "sfrOnly": responses[1].text
            }
        except Exception as e:
            print(f"Error fetching Zillow data: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

async def fetch_realtor_data(granularity: str) -> pd.DataFrame:
    """获取Realtor.com数据"""
    url = REALTOR_URLS.get(granularity)
    if not url:
        print(f"Invalid granularity level: {granularity}")
        return pd.DataFrame()
    
    print(f"Fetching data from {url}")
    # 对于zip level数据，使用更长的超时时间
    timeout = 60.0 if granularity == 'zip' else 30.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            
            if not response.text.strip():
                print("Empty response")
                return pd.DataFrame()
            
            # 根据粒度级别选择要读取的列
            usecols = ['month_date_yyyymm', 'active_listing_count', 'pending_listing_count', 
                      'median_days_on_market', 'price_reduced_count']
            
            if granularity == 'county':
                usecols.extend(['county_name'])
            elif granularity == 'zip':
                usecols.extend(['postal_code'])
            else:
                usecols.append(REGION_COLUMNS[granularity])
            
            # 使用chunksize分批读取大文件
            if granularity in ['zip', 'county']:
                chunks = []
                for chunk in pd.read_csv(StringIO(response.text), usecols=usecols, chunksize=10000, dtype={'postal_code': str}):
                    # 数据类型转换
                    chunk['month_date_yyyymm'] = pd.to_numeric(chunk['month_date_yyyymm'], errors='coerce')
                    numeric_columns = ['active_listing_count', 'pending_listing_count', 
                                     'median_days_on_market', 'price_reduced_count']
                    
                    for col in numeric_columns:
                        chunk[col] = pd.to_numeric(chunk[col], errors='coerce')
                    
                    # 移除无效数据
                    chunk = chunk.dropna(subset=['month_date_yyyymm'] + numeric_columns)
                    chunks.append(chunk)
                
                if not chunks:
                    print("No valid data chunks found")
                    return pd.DataFrame()
                
                df = pd.concat(chunks, ignore_index=True)
                
                # 确保zip code是字符串类型
                if granularity == 'zip' and 'postal_code' in df.columns:
                    df['postal_code'] = df['postal_code'].astype(str)
            else:
                df = pd.read_csv(StringIO(response.text), usecols=usecols)
                # 数据类型转换
                df['month_date_yyyymm'] = pd.to_numeric(df['month_date_yyyymm'], errors='coerce')
                numeric_columns = ['active_listing_count', 'pending_listing_count', 
                                 'median_days_on_market', 'price_reduced_count']
                
                for col in numeric_columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # 移除无效数据
                df = df.dropna(subset=['month_date_yyyymm'] + numeric_columns)
            
            print(f"Successfully loaded {len(df)} rows of data")
            return df
            
        except Exception as e:
            print(f"Error fetching data: {str(e)}")
            return pd.DataFrame()

def calculate_metrics(df: pd.DataFrame, region_col: str) -> List[Dict]:
    """计算供需均衡指标"""
    try:
        if df.empty:
            print("输入数据为空")
            return []

        # 获取最新月份数据
        latest_month = df['month_date_yyyymm'].max()
        latest_month_num = latest_month % 100  # 获取月份数字
        print(f"最新月份: {latest_month}, 月份数字: {latest_month_num}")
        
        # 定义疫情前时期 (2016-2019)，只选择同月份的数据
        pre_pandemic = df[
            (df['month_date_yyyymm'] >= 201601) & 
            (df['month_date_yyyymm'] <= 201912) &
            (df['month_date_yyyymm'] % 100 == latest_month_num)  # 只选择同月份
        ]
        print(f"疫情前同月数据数量: {len(pre_pandemic)}")
        
        # 获取当前月份数据
        current_data = df[df['month_date_yyyymm'] == latest_month]
        print(f"当前月份数据数量: {len(current_data)}")
        
        results = []
        for region in current_data[region_col].unique():
            try:
                # 获取当前数据
                current_row = current_data[current_data[region_col] == region].iloc[0]
                current_active = float(current_row['active_listing_count'])
                current_pending = float(current_row['pending_listing_count'])
                
                # 获取疫情前该地区数据
                historical_data = pre_pandemic[pre_pandemic[region_col] == region]
                
                # 只使用有效数据计算历史平均值
                hist_active = historical_data['active_listing_count']
                hist_pending = historical_data['pending_listing_count']
                
                # 过滤有效数据（大于0）
                valid_active = hist_active[hist_active > 0]
                valid_pending = hist_pending[hist_pending > 0]
                
                print(f"处理地区 {region}:")
                print(f"  当前活跃列表: {current_active}")
                print(f"  当前待定列表: {current_pending}")
                print(f"  历史有效活跃数据点数量: {len(valid_active)}")
                print(f"  历史有效待定数据点数量: {len(valid_pending)}")
                
                # 检查是否有足够的有效数据（至少3个历史数据点）
                if len(valid_active) >= 3 and len(valid_pending) >= 3 and current_active > 0 and current_pending > 0:
                    # 计算历史平均值
                    hist_active_mean = valid_active.mean()
                    hist_pending_mean = valid_pending.mean()
                    
                    # 检查数据是否满足最小样本量要求（30）
                    if current_active < 30 or current_pending < 30 or hist_active_mean < 30 or hist_pending_mean < 30:
                        print(f"  跳过地区 {region} - 样本量不足:")
                        print(f"    当前活跃: {current_active:.2f}")
                        print(f"    当前待定: {current_pending:.2f}")
                        print(f"    历史活跃平均: {hist_active_mean:.2f}")
                        print(f"    历史待定平均: {hist_pending_mean:.2f}")
                        continue
                    
                    # 计算当前比率和历史比率
                    current_ratio = current_pending / current_active
                    historical_ratio = hist_pending_mean / hist_active_mean
                    
                    # 计算各项变化百分比
                    active_change = ((current_active - hist_active_mean) / hist_active_mean) * 100
                    pending_change = ((current_pending - hist_pending_mean) / hist_pending_mean) * 100
                    ratio_change = ((current_ratio - historical_ratio) / historical_ratio) * 100
                    
                    print(f"  历史活跃平均值: {hist_active_mean}")
                    print(f"  历史待定平均值: {hist_pending_mean}")
                    print(f"  活跃变化百分比: {active_change}%")
                    print(f"  待定变化百分比: {pending_change}%")
                    print(f"  比率变化百分比: {ratio_change}%")
                    
                    if all(np.isfinite([active_change, pending_change, ratio_change])):
                        results.append({
                            'region': region,
                            'currentActive': round(current_active, 2),
                            'historicalActive': round(hist_active_mean, 2),
                            'changePercentage': round(active_change, 2),
                            'currentPending': round(current_pending, 2),
                            'historicalPending': round(hist_pending_mean, 2),
                            'pendingChange': round(pending_change, 2),
                            'currentRatio': round(current_ratio, 4),
                            'historicalRatio': round(historical_ratio, 4),
                            'ratioChange': round(ratio_change, 2)
                        })
                    else:
                        print(f"  跳过地区 {region} - 存在无效计算结果")
                else:
                    print(f"  跳过地区 {region} - 数据不足")
            except Exception as e:
                print(f"  处理地区 {region} 时出错: {str(e)}")
                continue
        
        print(f"总共处理了 {len(results)} 个地区")
        return results
    except Exception as e:
        print(f"计算指标时出错: {str(e)}")
        return []

def get_top_bottom(data: List[Dict], metric: str, n: int = 10) -> Tuple[List[Dict], List[Dict]]:
    """获取指定指标的前N和后N个地区"""
    try:
        # 根据指标名称获取相应的数据
        if metric == 'active':
            sorted_data = sorted(data, key=lambda x: x['changePercentage'], reverse=True)
            top = [{'region': item['region'], 
                   'current': item['currentActive'],
                   'prePandemic': item['historicalActive'],
                   'changePercentage': item['changePercentage']} for item in sorted_data[:n]]
            bottom = [{'region': item['region'], 
                      'current': item['currentActive'],
                      'prePandemic': item['historicalActive'],
                      'changePercentage': item['changePercentage']} for item in sorted_data[-n:]]
        elif metric == 'pending':
            sorted_data = sorted(data, key=lambda x: x['pendingChange'], reverse=True)
            top = [{'region': item['region'], 
                   'current': item['currentPending'],
                   'prePandemic': item['historicalPending'],
                   'changePercentage': item['pendingChange']} for item in sorted_data[:n]]
            bottom = [{'region': item['region'], 
                      'current': item['currentPending'],
                      'prePandemic': item['historicalPending'],
                      'changePercentage': item['pendingChange']} for item in sorted_data[-n:]]
        else:  # ratio
            sorted_data = sorted(data, key=lambda x: x['ratioChange'], reverse=True)
            top = [{'region': item['region'], 
                   'current': item['currentRatio'],
                   'prePandemic': item['historicalRatio'],
                   'changePercentage': item['ratioChange']} for item in sorted_data[:n]]
            bottom = [{'region': item['region'], 
                      'current': item['currentRatio'],
                      'prePandemic': item['historicalRatio'],
                      'changePercentage': item['ratioChange']} for item in sorted_data[-n:]]
        
        return top, bottom
    except Exception as e:
        print(f"获取排名时出错: {str(e)}")
        return [], []

@app.get("/api/market-balance")
async def get_market_balance():
    """获取市场供需平衡数据"""
    try:
        print("开始获取市场平衡数据...")
        df = await fetch_realtor_data('metro')
        if df.empty:
            print("Error: Empty DataFrame received from fetch_realtor_data")
            return {
                "active": {"top": [], "bottom": []},
                "pending": {"top": [], "bottom": []},
                "ratio": {"top": [], "bottom": []}
            }
        
        print(f"成功获取数据，开始计算指标...")
        results = calculate_metrics(df, REGION_COLUMNS['metro'])
        if not results:
            print("Error: No results from calculate_metrics")
            return {
                "active": {"top": [], "bottom": []},
                "pending": {"top": [], "bottom": []},
                "ratio": {"top": [], "bottom": []}
            }
            
        print(f"计算完成，开始处理活跃列表变化...")
        # 处理活跃列表变化
        active_top, active_bottom = get_top_bottom(results, 'active')
        
        print(f"处理待定列表变化...")
        # 处理待定列表变化
        pending_top, pending_bottom = get_top_bottom(results, 'pending')
        
        print(f"处理比率变化...")
        # 处理比率变化
        ratio_top, ratio_bottom = get_top_bottom(results, 'ratio')
        
        response_data = {
            "active": {
                "top": active_top,
                "bottom": active_bottom
            },
            "pending": {
                "top": pending_top,
                "bottom": pending_bottom
            },
            "ratio": {
                "top": ratio_top,
                "bottom": ratio_bottom
            }
        }
        
        print("返回数据示例:")
        print("Active listings top 1:")
        if active_top:
            print(f"  {active_top[0]}")
        print("Pending listings top 1:")
        if pending_top:
            print(f"  {pending_top[0]}")
        print("Ratio listings top 1:")
        if ratio_top:
            print(f"  {ratio_top[0]}")
            
        return response_data
        
    except Exception as e:
        print(f"Error in get_market_balance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/regions")
async def get_regions(granularity: str = Query(..., pattern="^(national|state|metro|county|zip)$")):
    try:
        # 对于所有粒度级别，使用Realtor.com的数据
        df = await fetch_realtor_data(granularity)
        if df.empty:
            return []
        
        # 根据不同粒度级别选择正确的列名
        region_col = REGION_COLUMNS[granularity]
        
        # 对于zip code，确保它是字符串类型
        if granularity == 'zip':
            df[region_col] = df[region_col].astype(str)
        
        regions = df[region_col].unique().tolist()
        regions.sort()
        
        return [{"id": str(i), "name": name} for i, name in enumerate(regions)]
            
    except Exception as e:
        print(f"Error in get_regions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/metrics/{granularity}/{region}")
async def get_metrics(
    granularity: str = Path(..., pattern="^(national|state|metro|county|zip)$"),
    region: str = Path(...)
):
    """获取指定地区的所有指标数据"""
    try:
        df = await fetch_realtor_data(granularity)
        if df.empty:
            return {}
        
        # 根据不同粒度级别过滤数据
        if granularity == 'county':
            df = df[df['county_name'] == region]
        elif granularity == 'zip':
            df = df[df['postal_code'] == int(region)]
        else:
            region_col = REGION_COLUMNS[granularity]
            df = df[df[region_col] == region]
        
        if df.empty:
            return {}
        
        # 获取最近12个月的数据
        latest_month = df['month_date_yyyymm'].max()
        twelve_months_ago = latest_month - 100  # 简单的月份减法
        
        recent_data = df[df['month_date_yyyymm'] > twelve_months_ago]
        
        metrics = {
            'active_listing_count': [],
            'pending_listing_count': [],
            'pending_ratio': [],
            'median_days_on_market': [],
            'price_reduced_count': []
        }
        
        for month in sorted(recent_data['month_date_yyyymm'].unique()):
            month_data = recent_data[recent_data['month_date_yyyymm'] == month]
            month_num = month % 100
            
            # 获取疫情前同月份的数据
            historical_data = df[
                (df['month_date_yyyymm'] >= 201601) & 
                (df['month_date_yyyymm'] <= 201912) &
                (df['month_date_yyyymm'] % 100 == month_num)
            ]
            
            month_str = f"{int(month//100)}-{int(month%100):02d}"
            
            for metric in ['active_listing_count', 'pending_listing_count', 
                          'median_days_on_market', 'price_reduced_count']:
                try:
                    current = float(month_data[metric].iloc[0])
                    
                    # 过滤有效的历史数据（大于0）
                    valid_historical = historical_data[historical_data[metric] > 0]
                    
                    # 确保有足够的历史数据点（至少3个）
                    if len(valid_historical) >= 3:
                        historical = float(valid_historical[metric].mean())
                        
                        if np.isfinite(current) and np.isfinite(historical):
                            pct_change = ((current - historical) / historical) * 100
                        else:
                            pct_change = None
                    else:
                        historical = None
                        pct_change = None
                        
                    metrics[metric].append({
                        'month': month_str,
                        'current': current if np.isfinite(current) else None,
                        'historical': historical if historical is not None and np.isfinite(historical) else None,
                        'percentChange': round(pct_change, 2) if pct_change is not None else None
                    })
                except:
                    continue
            
            # 计算pending ratio
            try:
                current_active = float(month_data['active_listing_count'].iloc[0])
                current_pending = float(month_data['pending_listing_count'].iloc[0])
                
                # 过滤有效的历史数据
                valid_hist_active = historical_data[historical_data['active_listing_count'] > 0]
                valid_hist_pending = historical_data[historical_data['pending_listing_count'] > 0]
                
                # 确保有足够的历史数据点（至少3个）
                if len(valid_hist_active) >= 3 and len(valid_hist_pending) >= 3:
                    hist_active = float(valid_hist_active['active_listing_count'].mean())
                    hist_pending = float(valid_hist_pending['pending_listing_count'].mean())
                    
                    if current_active > 0 and hist_active > 0:
                        current_ratio = current_pending / current_active
                        historical_ratio = hist_pending / hist_active
                        pct_change = ((current_ratio - historical_ratio) / historical_ratio) * 100
                        
                        metrics['pending_ratio'].append({
                            'month': month_str,
                            'current': round(current_ratio, 4),
                            'historical': round(historical_ratio, 4),
                            'percentChange': round(pct_change, 2)
                        })
                else:
                    metrics['pending_ratio'].append({
                        'month': month_str,
                        'current': round(current_pending / current_active, 4) if current_active > 0 else None,
                        'historical': None,
                        'percentChange': None
                    })
            except:
                continue
        
        return metrics
    except Exception as e:
        print(f"Error in get_metrics: {str(e)}")
        return {}

async def fetch_zillow_affordability_data(data_type: str) -> pd.DataFrame:
    """获取Zillow可负担性数据"""
    url = ZILLOW_AFFORDABILITY_URLS.get(data_type)
    if not url:
        print(f"Invalid data type: {data_type}")
        return pd.DataFrame()
    
    print(f"Fetching {data_type} data from {url}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            print(f"Sending request to {url}")
            response = await client.get(url)
            print(f"Response status code: {response.status_code}")
            response.raise_for_status()
            
            if not response.text.strip():
                print("Empty response")
                return pd.DataFrame()
            
            print(f"Response content length: {len(response.text)}")
            print(f"First 200 characters of response: {response.text[:200]}")
            
            df = pd.read_csv(StringIO(response.text))
            print(f"DataFrame shape: {df.shape}")
            print(f"DataFrame columns: {df.columns.tolist()}")
            
            # 修改日期列名处理逻辑
            date_columns = [col for col in df.columns if re.match(r'^\d{4}-\d{2}-\d{2}$', col)]
            print(f"Found {len(date_columns)} date columns")
            renamed_columns = {}
            for col in date_columns:
                # 保留原始日期列名，不再截断到月份
                renamed_columns[col] = col
            
            # 重命名列
            df = df.rename(columns=renamed_columns)
            
            print(f"Raw columns for {data_type}: {list(df.columns)}")
            print(f"Renamed columns for {data_type}: {list(df.columns)}")
            print(f"Sample data for {data_type}:")
            print(df.head())
            
            return df
            
        except Exception as e:
            print(f"Error fetching {data_type} data: {str(e)}")
            print(f"Error type: {type(e)}")
            print(f"Error details: {e.__dict__}")
            return pd.DataFrame()

def calculate_affordability_metrics(homeowner_df: pd.DataFrame, renter_df: pd.DataFrame) -> List[Dict]:
    """计算可负担性指标"""
    try:
        if homeowner_df.empty or renter_df.empty:
            print("输入数据为空")
            return []
        
        # 获取最新月份的列名（除了RegionID等非月份列）
        date_columns = [col for col in homeowner_df.columns 
                       if re.match(r'\d{4}-\d{2}', col)]
        latest_month = sorted(date_columns)[-1]
        print(f"最新月份: {latest_month}")
        
        results = []
        total_regions = len(homeowner_df)
        processed_regions = 0
        valid_results = 0
        invalid_results = 0
        
        for _, homeowner_row in homeowner_df.iterrows():
            try:
                region = homeowner_row['RegionName']
                processed_regions += 1
                print(f"\n处理地区 ({processed_regions}/{total_regions}): {region}")
                
                # 检查是否存在匹配的租户数据
                renter_data = renter_df[renter_df['RegionName'] == region]
                if renter_data.empty:
                    print(f"地区 {region} 没有租户数据")
                    invalid_results += 1
                    continue
                
                # 获取租户数据
                try:
                    renter_row = renter_data.iloc[0]
                    renter_value = float(renter_row[latest_month])
                    if pd.isna(renter_value) or renter_value == 0:
                        print(f"地区 {region} 的租户数据无效: {renter_value}")
                        invalid_results += 1
                        continue
                    print(f"租户可负担性: {renter_value}")
                except (KeyError, IndexError, ValueError) as e:
                    print(f"地区 {region} 的租户数据访问错误: {str(e)}")
                    invalid_results += 1
                    continue
                
                # 获取房主数据
                try:
                    homeowner_value = float(homeowner_row[latest_month])
                    if pd.isna(homeowner_value) or homeowner_value == 0:
                        print(f"地区 {region} 的房主数据无效: {homeowner_value}")
                        homeowner_value = None
                    print(f"房主可负担性: {homeowner_value}")
                except (ValueError, KeyError) as e:
                    print(f"地区 {region} 的房主数据错误: {str(e)}")
                    homeowner_value = None
                
                # 计算可负担性差距
                affordability_gap = None
                if homeowner_value is not None:
                    affordability_gap = homeowner_value - renter_value
                    print(f"可负担性差距: {affordability_gap}")
                
                results.append({
                    'region': region,
                    'homeownerAffordability': homeowner_value,
                    'renterAffordability': renter_value,
                    'affordabilityGap': affordability_gap
                })
                
                if affordability_gap is not None:
                    valid_results += 1
                else:
                    invalid_results += 1
                
            except Exception as e:
                print(f"处理地区 {region} 时发生错误: {str(e)}")
                invalid_results += 1
                continue
        
        print(f"\n处理完成:")
        print(f"总地区数: {total_regions}")
        print(f"处理地区数: {processed_regions}")
        print(f"有效结果数: {valid_results}")
        print(f"无效结果数: {invalid_results}")
        
        # 分离有效值和无效值
        valid_results = [r for r in results if r['affordabilityGap'] is not None]
        invalid_results = [r for r in results if r['affordabilityGap'] is None]
        
        # 只对有效值进行排序
        sorted_valid_results = sorted(valid_results, key=lambda x: x['affordabilityGap'], reverse=True)
        
        # 将无效值添加到末尾
        sorted_results = sorted_valid_results + invalid_results
        
        print(f"\n排序后的结果示例:")
        if sorted_results:
            print(f"第一条记录: {sorted_results[0]}")
            if len(sorted_results) > 1:
                print(f"第二条记录: {sorted_results[1]}")
        
        return sorted_results
        
    except Exception as e:
        print(f"计算可负担性指标时发生错误: {str(e)}")
        return []

def calculate_regression_trend(data: List[float]) -> List[float]:
    """使用最近6个月的数据计算回归趋势"""
    if len(data) < 3:  # 至少需要3个点才能计算趋势
        return [None] * len(data)
    
    # 移除无效值
    valid_data = [(i, x) for i, x in enumerate(data) if x is not None and not np.isnan(x)]
    if len(valid_data) < 3:  # 确保有足够的有效数据点
        return [None] * len(data)
    
    # 只使用最近6个月的有效数据
    valid_indices, valid_values = zip(*valid_data[-6:])
    x = np.array(valid_indices)
    y = np.array(valid_values)
    
    try:
        # 计算趋势线
        slope, intercept = np.polyfit(x, y, 1)
        
        # 生成趋势线值
        trend_values = [None] * len(data)
        for i in range(len(data)):
            if i >= valid_indices[0]:  # 只为有效数据范围生成趋势值
                trend_values[i] = slope * i + intercept
        return trend_values
    except:
        return [None] * len(data)

@app.get("/api/affordability-summary")
async def get_affordability_summary():
    """获取可负担性汇总数据"""
    try:
        print("开始获取可负担性汇总数据...")
        homeowner_df = await fetch_zillow_affordability_data('homeowner')
        renter_df = await fetch_zillow_affordability_data('renter')
        
        if homeowner_df.empty or renter_df.empty:
            return {
                "leastAffordable": [],
                "mostAffordable": []
            }
        
        results = calculate_affordability_metrics(homeowner_df, renter_df)
        if not results:
            return {
                "leastAffordable": [],
                "mostAffordable": []
            }
        
        # 分离有效值和无效值
        valid_results = [r for r in results if r['affordabilityGap'] is not None]
        invalid_results = [r for r in results if r['affordabilityGap'] is None]
        
        # 只对有效值进行排序
        sorted_valid_results = sorted(valid_results, key=lambda x: x['affordabilityGap'], reverse=True)
        
        # 将无效值添加到末尾
        sorted_results = sorted_valid_results + invalid_results
        
        return {
            "leastAffordable": sorted_results[:10],  # 最不可负担的10个市场
            "mostAffordable": sorted_valid_results[-10:][::-1]  # 最可负担的10个市场（只从有效值中选择）
        }
        
    except Exception as e:
        print(f"Error in get_affordability_summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/affordability-metrics/{region}")
async def get_affordability_metrics(region: str):
    try:
        print(f"Processing data for {region}")
        
        # 获取所有数据集
        homeowner_df = await fetch_zillow_affordability_data("homeowner")
        renter_df = await fetch_zillow_affordability_data("renter")
        total_payment_df = await fetch_zillow_affordability_data("total_payment")
        mortgage_payment_df = await fetch_zillow_affordability_data("mortgage_payment")
        affordable_price_df = await fetch_zillow_affordability_data("affordable_price")
        median_price_df = await fetch_zillow_affordability_data("median_price")

        # 找到目标地区的数据
        region_data = []
        
        # 获取所有日期列
        date_pattern = r'^\d{4}-\d{2}-\d{2}$'
        all_date_columns = set()
        
        for df in [homeowner_df, renter_df, total_payment_df, mortgage_payment_df, 
                  affordable_price_df, median_price_df]:
            if df is not None:
                date_cols = [col for col in df.columns if re.match(date_pattern, col)]
                all_date_columns.update(date_cols)
        
        all_date_columns = sorted(list(all_date_columns))
        print(f"All available date columns: {all_date_columns}")

        # 对每个日期创建一个数据点
        for date in all_date_columns:
            data_point = {"month": date.split('-')[0] + '-' + date.split('-')[1]}
            
            # 获取各个指标的值（如果可用）
            if homeowner_df is not None and date in homeowner_df.columns:
                homeowner_value = homeowner_df[homeowner_df['RegionName'] == region][date].iloc[0]
                data_point["homeownerAffordability"] = float(homeowner_value) if pd.notna(homeowner_value) else None
            else:
                data_point["homeownerAffordability"] = None
                
            if renter_df is not None and date in renter_df.columns:
                renter_value = renter_df[renter_df['RegionName'] == region][date].iloc[0]
                data_point["renterAffordability"] = float(renter_value) if pd.notna(renter_value) else None
            else:
                data_point["renterAffordability"] = None
                
            # 计算可负担性差距（如果两个值都可用）
            if data_point["homeownerAffordability"] is not None and data_point["renterAffordability"] is not None:
                data_point["affordabilityGap"] = data_point["homeownerAffordability"] - data_point["renterAffordability"]
            else:
                data_point["affordabilityGap"] = None
                
            # 获取支付相关的值
            if total_payment_df is not None and date in total_payment_df.columns:
                total_value = total_payment_df[total_payment_df['RegionName'] == region][date].iloc[0]
                data_point["totalPayment"] = float(total_value) if pd.notna(total_value) else None
            else:
                data_point["totalPayment"] = None
                
            if mortgage_payment_df is not None and date in mortgage_payment_df.columns:
                mortgage_value = mortgage_payment_df[mortgage_payment_df['RegionName'] == region][date].iloc[0]
                data_point["mortgagePayment"] = float(mortgage_value) if pd.notna(mortgage_value) else None
            else:
                data_point["mortgagePayment"] = None
                
            # 计算支付差距（如果两个值都可用）
            if data_point["totalPayment"] is not None and data_point["mortgagePayment"] is not None:
                data_point["paymentGap"] = data_point["totalPayment"] - data_point["mortgagePayment"]
            else:
                data_point["paymentGap"] = None
                
            # 获取价格相关的值
            if affordable_price_df is not None and date in affordable_price_df.columns:
                affordable_value = affordable_price_df[affordable_price_df['RegionName'] == region][date].iloc[0]
                data_point["affordablePrice"] = float(affordable_value) if pd.notna(affordable_value) else None
            else:
                data_point["affordablePrice"] = None
                
            if median_price_df is not None and date in median_price_df.columns:
                median_value = median_price_df[median_price_df['RegionName'] == region][date].iloc[0]
                data_point["medianPrice"] = float(median_value) if pd.notna(median_value) else None
            else:
                data_point["medianPrice"] = None
                
            # 计算价格差距（如果两个值都可用）
            if data_point["affordablePrice"] is not None and data_point["medianPrice"] is not None:
                data_point["priceGap"] = data_point["medianPrice"] - data_point["affordablePrice"]
            else:
                data_point["priceGap"] = None
                
            region_data.append(data_point)
            
        # 按月份排序
        region_data.sort(key=lambda x: x['month'])
        
        # 计算趋势线
        # 对于可负担性差距
        gap_values = [d["affordabilityGap"] for d in region_data]
        gap_trends = calculate_regression_trend(gap_values)
        for i, trend in enumerate(gap_trends):
            region_data[i]["gapTrend"] = trend
            
        # 对于价格差距
        price_gap_values = [d["priceGap"] for d in region_data]
        price_trends = calculate_regression_trend(price_gap_values)
        for i, trend in enumerate(price_trends):
            region_data[i]["priceTrend"] = trend

        return region_data
        
    except Exception as e:
        print(f"Error processing data for {region}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/affordability-regions")
async def get_affordability_regions():
    """获取Zillow可负担性数据中的地区列表"""
    try:
        # 获取Zillow数据中的地区列表
        homeowner_df = await fetch_zillow_affordability_data('homeowner')
        if homeowner_df.empty:
            return []
        
        regions = homeowner_df['RegionName'].unique().tolist()
        regions.sort()
        
        return [{"id": str(i), "name": region} for i, region in enumerate(regions)]
            
    except Exception as e:
        print(f"Error in get_affordability_regions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 