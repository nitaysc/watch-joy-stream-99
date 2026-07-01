import json
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from HdRezkaApi.api import HdRezkaApi

def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({'success': False, 'error': 'Missing URL argument'}))
            return
            
        url = sys.argv[1]
        rezka = HdRezkaApi(url)
        
        if len(sys.argv) >= 4:
            season = int(sys.argv[2])
            episode = int(sys.argv[3])
            tr_id = int(sys.argv[4]) if len(sys.argv) >= 5 and sys.argv[4] != "null" else None
            stream = rezka.getStream(season, episode, tr_id)
        else:
            tr_id = int(sys.argv[2]) if len(sys.argv) >= 3 and sys.argv[2] != "null" else None
            stream = rezka.getStream(None, None, tr_id)
            
        print(json.dumps({'success': True, 'videos': stream.videos}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
