#!/bin/sh

# Sync data to OneDrive 5TB and VPS
docker exec -it rclone rclone sync ubytxh:Shared/Ebooks/Library onedrive:Shared/Ebooks/Library -P --check-first --ignore-existing --track-renames --fix-case --server-side-across-configs --checkers=16 --transfers=8
docker exec -it rclone rclone sync ubytxh:Shared/Ebooks/Library /data/Ebooks -P --check-first --ignore-existing --track-renames --fix-case --server-side-across-configs --checkers=16 --transfers=8

# In case there is an error, can use args --checksum
# If using Google Colab, args -P is not necessary. Instead, use -vvvv to output.
# Change default config file location by using --config /path/to/config/rclone.conf

# Check data
docker exec -it rclone rclone size ubytxh:Shared/Ebooks/Library
docker exec -it rclone rclone size onedrive:Shared/Ebooks/Library
docker exec -it rclone rclone size /data/Ebooks

exit 0
