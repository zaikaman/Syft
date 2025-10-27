#!/usr/bin/env python3
"""
Prophet Forecasting Script for Syft DeFi Platform
Reads JSON input from stdin, runs Prophet forecast, outputs JSON to stdout
"""

import sys
import json
import pandas as pd
from prophet import Prophet
import warnings

warnings.filterwarnings('ignore')

def run_forecast(data, config):
    """
    Run Prophet forecast on time series data
    
    Args:
        data: List of dicts with 'ds' (date) and 'y' (value) keys
        config: Dict with Prophet configuration parameters
    
    Returns:
        Dict with forecast results
    """
    try:
        # Create DataFrame
        df = pd.DataFrame(data)
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Initialize Prophet with configuration
        model = Prophet(
            changepoint_prior_scale=config.get('changepoint_prior_scale', 0.05),
            seasonality_prior_scale=config.get('seasonality_prior_scale', 10),
            yearly_seasonality=config.get('yearly_seasonality', True),
            weekly_seasonality=config.get('weekly_seasonality', True),
            daily_seasonality=config.get('daily_seasonality', False)
        )
        
        # Fit model
        model.fit(df)
        
        # Make future dataframe
        periods = config.get('periods', 30)
        freq = config.get('freq', 'D')
        future = model.make_future_dataframe(periods=periods, freq=freq)
        
        # Predict
        forecast = model.predict(future)
        
        # Extract forecast data (only future periods)
        forecast_data = forecast.tail(periods)[['ds', 'yhat', 'yhat_lower', 'yhat_upper', 'trend']]
        
        # Convert to records
        result = {
            'forecast': forecast_data.to_dict('records'),
            'success': True
        }
        
        # Convert timestamps to ISO format strings
        for record in result['forecast']:
            record['ds'] = record['ds'].isoformat()
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        data = input_data.get('data', [])
        config = input_data.get('config', {})
        
        if not data:
            print(json.dumps({
                'success': False,
                'error': 'No data provided'
            }))
            sys.exit(1)
        
        # Run forecast
        result = run_forecast(data, config)
        
        # Output result as JSON
        print(json.dumps(result))
        
        if not result.get('success'):
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
