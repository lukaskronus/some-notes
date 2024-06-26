#!/bin/bash

# rclone sync to destinations
docker exec -it rclone rclone sync ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks" onedrive:Ebooks/Requested/"Anh Thuyen Ebooks" -P --ignore-existing --track-renames --fix-case --server-side-across-configs --check-first
docker exec -it rclone rclone sync ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks" gdrive:Ebooks/ -P --ignore-existing --track-renames --fix-case --server-side-across-configs --check-first
docker exec -it rclone rclone sync ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks" /data/Ebooks -P --ignore-existing --track-renames --fix-case --server-side-across-configs --check-first

rclone sync --config /mnt/apps/apps/rclone/rclone.config ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks" --exclude DISSERTION/ /mnt/NAS-BiTi/library --check-first -P --ignore-existing --track-renames --checkers=16 --transfers=8

# check data from source and destinations
docker exec -it rclone rclone size ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks"
docker exec -it rclone rclone size onedrive:Ebooks/Requested/"Anh Thuyen Ebooks"
docker exec -it rclone rclone size /data/Ebooks
docker exec -it rclone rclone size gdrive:Ebooks/

# check path
docker exec -it rclone rclone lsd ubytxh:Shared/Ebooks/Requested/"Anh Thuyen Ebooks"
docker exec -it rclone rclone lsd onedrive:Ebooks/Requested/"Anh Thuyen Ebooks"
docker exec -it rclone rclone lsd /data/Ebooks
docker exec -it rclone rclone lsd gdrive:Ebooks/
